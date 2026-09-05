/**
 * Municipalités → région, **en direct via Supabase** (table `municipalities`).
 *
 * - Lecture **publique** (RLS `select using (true)`) : le site lit la table au
 *   chargement de l'instantané et reclasse les offres côté navigateur, donc un
 *   changement s'applique **sans redéploiement** (voir `lib/data.ts`).
 * - Écriture **réservée aux admins** (RLS sur le courriel du jeton) : la console
 *   `/admin` ajoute/retire une municipalité, effet immédiat pour tous les visiteurs.
 *
 * Tant que la table n'existe pas / Supabase non configuré, tout retombe
 * proprement sur « aucune municipalité » (aucun reclassement) — rien ne casse.
 */
import { municipalityRegionMap, normMunicipality, regionForCity, type Municipality } from "@jobccq/shared";

export type { Municipality };

/** Ligne telle que stockée dans Supabase (colonnes snake_case). */
interface Row {
  name: string;
  region_id: string;
}

export interface ImportOfficialMunicipalitiesResult {
  imported: number;
  skipped: number;
  /** Alias ajoutés (localités / anciennes municipalités / secteurs). */
  aliases?: number;
  byRegion: Record<string, number>;
  sourceUrl: string;
  sourceLastModified: string | null;
  error?: string;
}

/**
 * Table nom normalisé → région, mise en cache (une seule lecture Supabase pour
 * toute la session). Sert au bouton « déduire la région d'une ville » de la
 * console d'admin. Invalidée dès qu'une municipalité est ajoutée / retirée.
 */
let regionMapCache: Promise<Map<string, string>> | null = null;

function municipalityMap(): Promise<Map<string, string>> {
  if (!regionMapCache) {
    regionMapCache = fetchMunicipalities()
      .then((list) => municipalityRegionMap(list))
      .catch(() => new Map<string, string>());
  }
  return regionMapCache;
}

/**
 * Déduit l'id de région administrative d'une ville via la table des
 * municipalités (Supabase). Renvoie `null` si la ville est vide, introuvable,
 * ou si la table n'est pas disponible.
 */
export async function resolveRegionForCity(city: string): Promise<string | null> {
  if (!city?.trim()) return null;
  const map = await municipalityMap();
  return regionForCity(map, city) ?? null;
}

/**
 * Lit **toutes** les municipalités (lecture publique). Renvoie [] si indisponible.
 *
 * PostgREST/Supabase plafonne un `select` à ~1000 lignes : la table dépasse ce
 * seuil (municipalités + alias), donc on **pagine** par tranches (tri sur `norm`,
 * clé primaire → pagination stable) sinon les villes tardives dans l'alphabet
 * (Trois-Rivières, Sherbrooke, Victoriaville…) sont silencieusement absentes.
 */
export async function fetchMunicipalities(): Promise<Municipality[]> {
  const { supabase } = await import("./supabase");
  if (!supabase) return [];
  const PAGE = 1000;
  const out: Municipality[] = [];
  // Garde-fou (50 pages) : évite toute boucle infinie si `range` était ignoré.
  for (let from = 0; from < PAGE * 50; from += PAGE) {
    const { data, error } = await supabase
      .from("municipalities")
      .select("name, region_id")
      .order("norm")
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    for (const r of data as Row[]) out.push({ name: r.name, regionId: r.region_id });
    if (data.length < PAGE) break; // dernière page atteinte
  }
  return out;
}

/** Ajoute ou met à jour une municipalité (admin ; contrôle d'accès par RLS). */
export async function upsertMunicipality(name: string, regionId: string): Promise<void> {
  const { supabase } = await import("./supabase");
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { error } = await supabase
    .from("municipalities")
    .upsert(
      { name: name.trim(), norm: normMunicipality(name), region_id: regionId },
      { onConflict: "norm" },
    );
  if (error) throw new Error(error.message);
  regionMapCache = null; // la table a changé → prochaine déduction relit Supabase
}

/** Supprime une municipalité par son nom (admin ; contrôle d'accès par RLS). */
export async function deleteMunicipality(name: string): Promise<void> {
  const { supabase } = await import("./supabase");
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { error } = await supabase.from("municipalities").delete().eq("norm", normMunicipality(name));
  if (error) throw new Error(error.message);
  regionMapCache = null; // la table a changé → prochaine déduction relit Supabase
}

/** Importe toutes les municipalités officielles du Québec depuis le CSV MAMH. */
export async function importOfficialMunicipalities(): Promise<ImportOfficialMunicipalitiesResult> {
  const { supabase } = await import("./supabase");
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data, error } = await supabase.functions.invoke<ImportOfficialMunicipalitiesResult>(
    "import-municipalities",
    { method: "POST" },
  );
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  if (!data) throw new Error("Réponse vide de la fonction d'import.");
  regionMapCache = null; // import massif → prochaine déduction relit Supabase
  return data;
}
