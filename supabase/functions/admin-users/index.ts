import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type User } from "npm:@supabase/supabase-js@2";

type AdminUserRow = {
  id: string;
  email: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  confirmedAt: string | null;
  providers: string[];
  bannedUntil?: string | null;
};

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

function siteUrl(): string {
  return (Deno.env.get("SITE_URL") ?? "https://jobccqc.ca").replace(/\/+$/, "");
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function userToRow(user: User): AdminUserRow {
  const providers = new Set<string>();
  if (typeof user.app_metadata?.provider === "string") providers.add(user.app_metadata.provider);
  const appProviders = user.app_metadata?.providers;
  if (Array.isArray(appProviders)) appProviders.forEach((provider) => providers.add(String(provider)));
  user.identities?.forEach((identity) => providers.add(identity.provider));
  return {
    id: user.id,
    email: user.email ?? user.phone ?? "(sans courriel)",
    createdAt: user.created_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    confirmedAt: user.email_confirmed_at ?? user.confirmed_at ?? null,
    providers: [...providers].sort(),
    bannedUntil: (user as User & { banned_until?: string | null }).banned_until ?? null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Méthode non permise." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!supabaseUrl || !serviceKey) return json({ error: "Configuration Supabase serveur manquante." }, 503);
  if (!token) return json({ error: "Connexion admin requise." }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: session, error: sessionError } = await admin.auth.getUser(token);
  const email = session.user?.email?.trim().toLowerCase();
  if (sessionError || !email) return json({ error: "Session Supabase invalide." }, 401);
  if (!adminEmails().includes(email)) return json({ error: "Compte non autorisé." }, 403);

  if (req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as {
      email?: unknown;
      userId?: unknown;
      ban?: unknown;
    };
    const userId = String(body.userId ?? "").trim();
    if (userId) {
      const { data: existing, error: lookupError } = await admin.auth.admin.getUserById(userId);
      if (lookupError || !existing.user) return json({ error: lookupError?.message ?? "Compte introuvable." }, 404);
      const targetEmail = existing.user.email?.trim().toLowerCase() ?? "";
      if (targetEmail && adminEmails().includes(targetEmail)) {
        return json({ error: "On ne bannit pas un administrateur." }, 400);
      }
      const ban = body.ban !== false;
      const { error } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: ban ? "876000h" : "none",
      });
      if (error) return json({ error: error.message }, 502);
      return json({ banned: ban, userId, email: targetEmail });
    }

    const inviteEmail = normalizeEmail(body.email);
    if (!isValidEmail(inviteEmail)) return json({ error: "Courriel invalide." }, 400);

    const { error } = await admin.auth.admin.inviteUserByEmail(inviteEmail, {
      redirectTo: `${siteUrl()}/favoris`,
    });
    if (error) return json({ error: error.message }, 502);
    return json({ invited: true, email: inviteEmail });
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return json({ error: error.message }, 502);

  return json({
    page: 1,
    perPage: 200,
    total: data.total ?? data.users.length,
    users: data.users.map(userToRow),
  });
});
