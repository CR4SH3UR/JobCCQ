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
import { normMunicipality, type Municipality } from "@jobccq/shared";

export type { Municipality };

/** Ligne telle que stockée dans Supabase (colonnes snake_case). */
interface Row {
  name: string;
  region_id: string;
}

/** Lit toutes les municipalités (lecture publique). Renvoie [] si indisponible. */
export async function fetchMunicipalities(): Promise<Municipality[]> {
  const { supabase } = await import("./supabase");
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("municipalities")
    .select("name, region_id")
    .order("name");
  if (error || !data) return [];
  return (data as Row[]).map((r) => ({ name: r.name, regionId: r.region_id }));
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
}

/** Supprime une municipalité par son nom (admin ; contrôle d'accès par RLS). */
export async function deleteMunicipality(name: string): Promise<void> {
  const { supabase } = await import("./supabase");
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { error } = await supabase.from("municipalities").delete().eq("norm", normMunicipality(name));
  if (error) throw new Error(error.message);
}
