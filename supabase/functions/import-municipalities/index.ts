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

/**
 * Alias **localité / ancienne municipalité / arrondissement / secteur → région**.
 *
 * Le fichier officiel du MAMH ne liste que les **municipalités actuelles** : les
 * villes fusionnées (Chicoutimi, Jonquière, Hull, Aylmer, Sainte-Foy, Beauport,
 * Cap-de-la-Madeleine…), les arrondissements de Montréal et les secteurs de Laval
 * n'y sont plus, alors qu'ils reviennent partout dans les offres d'emploi. On les
 * ajoute ici. Règle de sûreté : un alias n'écrase JAMAIS une municipalité
 * officielle de même nom (les villes distinctes — Dorval, Westmount, Brossard,
 * L'Ancienne-Lorette… — restent prioritaires).
 */
const ALIASES: ReadonlyArray<readonly [string, string]> = [
  // Montréal — arrondissements & quartiers (villes liées démembrées = officielles, non listées)
  ["Ahuntsic", "montreal"], ["Cartierville", "montreal"], ["Anjou", "montreal"],
  ["Côte-des-Neiges", "montreal"], ["Notre-Dame-de-Grâce", "montreal"], ["Lachine", "montreal"],
  ["LaSalle", "montreal"], ["Le Plateau-Mont-Royal", "montreal"], ["Plateau-Mont-Royal", "montreal"],
  ["Le Sud-Ouest", "montreal"], ["Mercier", "montreal"], ["Hochelaga-Maisonneuve", "montreal"],
  ["Maisonneuve", "montreal"], ["Montréal-Nord", "montreal"], ["Outremont", "montreal"],
  ["Pierrefonds", "montreal"], ["Roxboro", "montreal"], ["Rivière-des-Prairies", "montreal"],
  ["Pointe-aux-Trembles", "montreal"], ["Rosemont", "montreal"], ["La Petite-Patrie", "montreal"],
  ["Saint-Laurent", "montreal"], ["Saint-Léonard", "montreal"], ["Verdun", "montreal"],
  ["Ville-Marie", "montreal"], ["Villeray", "montreal"], ["Saint-Michel", "montreal"],
  ["Parc-Extension", "montreal"], ["L'Île-Bizard", "montreal"], ["Sainte-Geneviève", "montreal"],
  ["Ville-Émard", "montreal"], ["Griffintown", "montreal"],
  // Laval — secteurs
  ["Chomedey", "laval"], ["Sainte-Dorothée", "laval"], ["Sainte-Rose", "laval"],
  ["Vimont", "laval"], ["Auteuil", "laval"], ["Fabreville", "laval"],
  ["Laval-des-Rapides", "laval"], ["Pont-Viau", "laval"], ["Duvernay", "laval"],
  ["Saint-François", "laval"], ["Saint-Vincent-de-Paul", "laval"], ["Laval-Ouest", "laval"],
  ["Laval-sur-le-Lac", "laval"],
  // Québec — arrondissements & anciennes villes (L'Ancienne-Lorette / Saint-Augustin = officielles)
  ["Sainte-Foy", "capitale-nationale"], ["Sillery", "capitale-nationale"], ["Cap-Rouge", "capitale-nationale"],
  ["Beauport", "capitale-nationale"], ["Charlesbourg", "capitale-nationale"], ["Loretteville", "capitale-nationale"],
  ["Val-Bélair", "capitale-nationale"], ["Vanier", "capitale-nationale"], ["Lac-Saint-Charles", "capitale-nationale"],
  ["Saint-Émile", "capitale-nationale"], ["Limoilou", "capitale-nationale"], ["Neufchâtel", "capitale-nationale"],
  ["Duberger", "capitale-nationale"],
  // Lévis — secteurs
  ["Saint-Romuald", "chaudiere-appalaches"], ["Charny", "chaudiere-appalaches"], ["Saint-Nicolas", "chaudiere-appalaches"],
  ["Saint-Rédempteur", "chaudiere-appalaches"], ["Saint-Jean-Chrysostome", "chaudiere-appalaches"],
  ["Pintendre", "chaudiere-appalaches"], ["Lauzon", "chaudiere-appalaches"], ["Breakeyville", "chaudiere-appalaches"],
  ["Saint-Étienne-de-Lauzon", "chaudiere-appalaches"],
  // Longueuil — secteurs (Brossard, Saint-Lambert, Boucherville = officielles)
  ["Saint-Hubert", "monteregie"], ["Greenfield Park", "monteregie"], ["LeMoyne", "monteregie"],
  // Gatineau — secteurs
  ["Hull", "outaouais"], ["Aylmer", "outaouais"], ["Buckingham", "outaouais"], ["Masson-Angers", "outaouais"],
  // Saguenay — secteurs
  ["Chicoutimi", "saguenay-lac-saint-jean"], ["Jonquière", "saguenay-lac-saint-jean"], ["La Baie", "saguenay-lac-saint-jean"],
  ["Arvida", "saguenay-lac-saint-jean"], ["Kénogami", "saguenay-lac-saint-jean"], ["Laterrière", "saguenay-lac-saint-jean"],
  ["Shipshaw", "saguenay-lac-saint-jean"], ["Canton Tremblay", "saguenay-lac-saint-jean"],
  // Sherbrooke — secteurs
  ["Rock Forest", "estrie"], ["Fleurimont", "estrie"], ["Lennoxville", "estrie"],
  ["Ascot", "estrie"], ["Deauville", "estrie"], ["Bromptonville", "estrie"], ["Saint-Élie-d'Orford", "estrie"],
  // Trois-Rivières & Shawinigan — secteurs
  ["Cap-de-la-Madeleine", "mauricie"], ["Trois-Rivières-Ouest", "mauricie"], ["Pointe-du-Lac", "mauricie"],
  ["Sainte-Marthe-du-Cap", "mauricie"], ["Saint-Louis-de-France", "mauricie"], ["Grand-Mère", "mauricie"],
  ["Shawinigan-Sud", "mauricie"], ["Saint-Georges-de-Champlain", "mauricie"], ["Lac-à-la-Tortue", "mauricie"],
  // Laurentides
  ["Bellefeuille", "laurentides"], ["Lafontaine", "laurentides"], ["Saint-Jovite", "laurentides"],
  ["Saint-Canut", "laurentides"], ["Sainte-Scholastique", "laurentides"],
  // Lanaudière
  ["Lachenaie", "lanaudiere"], ["La Plaine", "lanaudiere"], ["Le Gardeur", "lanaudiere"],
  // Montérégie
  ["Iberville", "monteregie"], ["Saint-Luc", "monteregie"], ["L'Acadie", "monteregie"], ["Valleyfield", "monteregie"],
  // Bas-Saint-Laurent
  ["Pointe-au-Père", "bas-saint-laurent"], ["Le Bic", "bas-saint-laurent"], ["Sainte-Blandine", "bas-saint-laurent"],
  // Abitibi-Témiscamingue
  ["Noranda", "abitibi-temiscamingue"], ["Dubuisson", "abitibi-temiscamingue"], ["Sullivan", "abitibi-temiscamingue"],
  // Centre-du-Québec
  ["Saint-Nicéphore", "centre-du-quebec"], ["Arthabaska", "centre-du-quebec"],
];

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
  aliases: number;
  byRegion: Record<string, number>;
} {
  const parsed = parseCsv(csv);
  const [rawHeaders, ...body] = parsed;
  const headers = (rawHeaders ?? []).map((h) => h.replace(/^\uFEFF/, "").trim().toLowerCase());
  const nameIndex = headers.indexOf("munnom");
  const regionIndex = headers.indexOf("regadm");
  const popIndex = headers.indexOf("mpopul");
  if (nameIndex < 0 || regionIndex < 0) {
    throw new Error("Colonnes MAMH attendues introuvables (munnom, regadm).");
  }

  // On garde la population pour d\u00E9partager deux municipalit\u00E9s de m\u00EAme nom
  // (ex. \u00AB Clermont \u00BB, \u00AB L'Ange-Gardien \u00BB) : la plus peupl\u00E9e l'emporte, ce qui
  // correspond presque toujours \u00E0 celle attendue dans une offre d'emploi.
  const rows = new Map<string, MunicipalityRow & { pop: number }>();
  let skipped = 0;

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
    const pop = popIndex >= 0 ? Number(cleanText(line[popIndex]).replace(/[^\d]/g, "")) || 0 : 0;
    const existing = rows.get(norm);
    if (!existing || pop > existing.pop) rows.set(norm, { norm, name, region_id: regionId, pop });
  }

  // Alias (localit\u00E9s / anciennes municipalit\u00E9s / secteurs) : ajout\u00E9s seulement si
  // le nom normalis\u00E9 n'est pas d\u00E9j\u00E0 une municipalit\u00E9 officielle (l'officiel gagne).
  let aliases = 0;
  for (const [name, regionId] of ALIASES) {
    const norm = slugify(name);
    if (!norm || rows.has(norm)) continue;
    rows.set(norm, { norm, name, region_id: regionId, pop: 0 });
    aliases++;
  }

  const byRegion: Record<string, number> = {};
  const out: MunicipalityRow[] = [];
  for (const r of rows.values()) {
    byRegion[r.region_id] = (byRegion[r.region_id] ?? 0) + 1;
    out.push({ norm: r.norm, name: r.name, region_id: r.region_id });
  }

  return { rows: out, skipped, aliases, byRegion };
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

  const { rows, skipped, aliases, byRegion } = municipalitiesFromCsv(await source.text());
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await admin.from("municipalities").upsert(chunk, { onConflict: "norm" });
    if (error) return json({ error: error.message }, 502);
  }

  return json({
    imported: rows.length,
    skipped,
    aliases,
    byRegion,
    sourceUrl: SOURCE_URL,
    sourceLastModified: source.headers.get("last-modified"),
  });
});
