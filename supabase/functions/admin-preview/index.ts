import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const UA =
  "Mozilla/5.0 (compatible; JobCCQ-preview/1.0; +https://jobccqc.ca) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function adminEmails(): string[] {
  return (Deno.env.get("ADMIN_EMAILS") ?? "dickie1719@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non permise." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!supabaseUrl || !serviceKey) return json({ error: "Configuration Supabase serveur manquante." }, 503);
  if (!token) return json({ error: "Connexion admin requise." }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: session, error: sessionError } = await admin.auth.getUser(token);
  const email = session?.user?.email?.trim().toLowerCase();
  if (sessionError || !email) return json({ error: "Session Supabase invalide." }, 401);
  if (!adminEmails().includes(email)) return json({ error: "Compte non autorisé." }, 403);

  const body = (await req.json().catch(() => ({}))) as { url?: unknown };
  const url = String(body.url ?? "").trim();
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("bad");
  } catch {
    return json({ error: "URL invalide." }, 400);
  }

  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    const raw = await res.text();
    const html = raw.length > 900_000 ? raw.slice(0, 900_000) : raw;
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
    return json({
      ok: res.ok,
      status: res.status,
      bytes: raw.length,
      ms: Date.now() - started,
      title,
      contentType: res.headers.get("content-type") ?? "",
      html,
    });
  } catch (err) {
    return json(
      {
        ok: false,
        status: 0,
        bytes: 0,
        ms: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
});
