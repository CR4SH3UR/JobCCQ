import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SOURCE_URL = "https://donneesouvertes.affmunqc.net/repertoire/MUN.csv";

const REGION_IDS = new Set([
  "bas-saint-laurent",
  "saguenay-lac-saint-jean",
  "capitale-nationale",
  "mauricie",
  "estrie",
  "montreal",
  "outaouais",
  "abitibi-temiscamingue",
  "cote-nord",
  "nord-du-quebec",
  "gaspesie-iles-de-la-madeleine",
  "chaudiere-appalaches",
  "laval",
  "lanaudiere",
  "laurentides",
  "monteregie",
  "centre-du-quebec",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type MunicipalityRow = {
  norm: string;
  name: string;
  region_id: string;
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

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slugify(value: string): string {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function regionIdFromRegadm(value: string): string | undefined {
  const label = value.replace(/\s*\(\d+\)\s*$/, "");
  const id = slugify(label);
  return REGION_IDS.has(id) ? id : undefined;
}

function municipalitiesFromCsv(csv: string): {
  rows: MunicipalityRow[];
  skipped: number;
  byRegion: Record<string, number>;
} {
  const parsed = parseCsv(csv);
  const [rawHeaders, ...body] = parsed;
  const headers = (rawHeaders ?? []).map((h) => h.replace(/^\uFEFF/, "").trim().toLowerCase());
  const nameIndex = headers.indexOf("munnom");
  const regionIndex = headers.indexOf("regadm");
  if (nameIndex < 0 || regionIndex < 0) {
    throw new Error("Colonnes MAMH attendues introuvables (munnom, regadm).");
  }

  const rows = new Map<string, MunicipalityRow>();
  let skipped = 0;
  const byRegion: Record<string, number> = {};

  for (const line of body) {
    const name = cleanText(line[nameIndex]);
    const regionId = regionIdFromRegadm(cleanText(line[regionIndex]));
    if (!name || !regionId) {
      skipped++;
      continue;
    }
    const norm = slugify(name);
    if (!norm) {
      skipped++;
      continue;
    }
    if (!rows.has(norm)) byRegion[regionId] = (byRegion[regionId] ?? 0) + 1;
    rows.set(norm, { norm, name, region_id: regionId });
  }

  return { rows: [...rows.values()], skipped, byRegion };
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
  const email = session.user?.email?.trim().toLowerCase();
  if (sessionError || !email) return json({ error: "Session Supabase invalide." }, 401);
  if (!adminEmails().includes(email)) return json({ error: "Compte non autorisé." }, 403);

  const source = await fetch(SOURCE_URL);
  if (!source.ok) return json({ error: `MAMH HTTP ${source.status}` }, 502);

  const { rows, skipped, byRegion } = municipalitiesFromCsv(await source.text());
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await admin.from("municipalities").upsert(chunk, { onConflict: "norm" });
    if (error) return json({ error: error.message }, 502);
  }

  return json({
    imported: rows.length,
    skipped,
    byRegion,
    sourceUrl: SOURCE_URL,
    sourceLastModified: source.headers.get("last-modified"),
  });
});
