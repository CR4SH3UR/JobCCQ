import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Edge Function login-activity
 * - POST (sans userId) : enregistre la connexion du compte authentifié (IP + géo).
 * - GET  ?userId=…     : liste les 10 dernières connexions (admin seulement).
 *
 * Repli pour le site statique (GitHub Pages) quand l'API Fastify n'est pas joignable.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function adminEmails(): string[] {
  return (Deno.env.get("ADMIN_EMAILS") ?? "dickie1719@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function unmapV4(ip: string): string {
  const m = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(ip);
  return m ? m[1]! : ip;
}

function clientIp(req: Request): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  const real = req.headers.get("x-real-ip")?.trim();
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  const ip = (first || cf || real || "").trim();
  if (!ip) return undefined;
  return unmapV4(ip) || undefined;
}

function isPrivateIp(ip?: string): boolean {
  if (!ip) return true;
  const v = unmapV4(ip.trim());
  if (v === "::1" || v.toLowerCase().startsWith("fe80") || v.toLowerCase().startsWith("fc") ||
    v.toLowerCase().startsWith("fd")) {
    return true;
  }
  if (/^(10|127)\./.test(v)) return true;
  if (/^192\.168\./.test(v)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(v)) return true;
  if (v === "0.0.0.0" || v === "") return true;
  return false;
}

type GeoInfo = { country?: string; region?: string; city?: string };

async function geoLookup(ip: string): Promise<GeoInfo | null> {
  if (isPrivateIp(ip)) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: ctrl.signal })
      .finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const o = (await res.json()) as Record<string, unknown>;
    if (o.success === false) return null;
    const str = (v: unknown): string | undefined => {
      const s = typeof v === "string" ? v.trim() : "";
      return s || undefined;
    };
    return {
      country: str(o.country) ?? str(o.country_name),
      region: str(o.region) ?? str(o.region_name) ?? str(o.regionName),
      city: str(o.city),
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Méthode non permise." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!supabaseUrl || !serviceKey) return json({ error: "Configuration Supabase serveur manquante." }, 503);
  if (!token) return json({ error: "Connexion requise." }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: session, error: sessionError } = await admin.auth.getUser(token);
  const user = session.user;
  const email = user?.email?.trim().toLowerCase() ?? "";
  if (sessionError || !user) return json({ error: "Session Supabase invalide." }, 401);

  // --- Lecture admin ---
  if (req.method === "GET") {
    if (!adminEmails().includes(email)) return json({ error: "Compte non autorisé." }, 403);
    const url = new URL(req.url);
    const userId = (url.searchParams.get("userId") ?? "").trim();
    if (!userId) return json({ error: "Identifiant manquant." }, 400);

    const { data, error } = await admin
      .from("user_login_activity")
      .select("ip, country, region, city, user_agent, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return json({ activity: [], note: error.message });
    return json({
      activity: (data ?? []).map((r) => ({
        ip: r.ip ?? null,
        country: r.country ?? null,
        region: r.region ?? null,
        city: r.city ?? null,
        userAgent: r.user_agent ?? null,
        at: r.created_at ?? null,
      })),
    });
  }

  // --- Enregistrement (tout compte authentifié) ---
  const body = (await req.json().catch(() => ({}))) as { userId?: unknown };
  // Si un admin poste avec userId, on renvoie la liste (repli pour invoke sans query).
  const listUserId = String(body.userId ?? "").trim();
  if (listUserId) {
    if (!adminEmails().includes(email)) return json({ error: "Compte non autorisé." }, 403);
    const { data, error } = await admin
      .from("user_login_activity")
      .select("ip, country, region, city, user_agent, created_at")
      .eq("user_id", listUserId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return json({ activity: [], note: error.message });
    return json({
      activity: (data ?? []).map((r) => ({
        ip: r.ip ?? null,
        country: r.country ?? null,
        region: r.region ?? null,
        city: r.city ?? null,
        userAgent: r.user_agent ?? null,
        at: r.created_at ?? null,
      })),
    });
  }

  const ip = clientIp(req);
  const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 400) || null;

  // Anti-doublon : même IP dans les 10 min.
  try {
    const { data: last } = await admin
      .from("user_login_activity")
      .select("ip, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const prev = last?.[0];
    if (prev && prev.ip === ip && prev.created_at) {
      const age = Date.now() - new Date(prev.created_at).getTime();
      if (age >= 0 && age < 10 * 60 * 1000) return json({ recorded: false, reason: "dedup" });
    }
  } catch {
    /* table absente : l'insert renverra l'erreur */
  }

  const geo = ip ? await geoLookup(ip) : null;
  const { error } = await admin.from("user_login_activity").insert({
    user_id: user.id,
    ip: ip ?? null,
    country: geo?.country ?? null,
    region: geo?.region ?? null,
    city: geo?.city ?? null,
    user_agent: userAgent,
  });
  if (error) return json({ recorded: false, note: error.message });
  return json({ recorded: true });
});
