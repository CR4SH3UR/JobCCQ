/**
 * Reclassement **municipalité → région administrative**.
 *
 * La liste des municipalités vit dans **Supabase** (table `municipalities`,
 * éditable depuis la console admin, lue en direct par le site). Ce module ne
 * fournit que les fonctions **pures** partagées (normalisation d'un nom de ville
 * et construction de la table de correspondance) ; les lectures/écritures
 * Supabase se font côté web (`apps/web/src/lib/municipalities.ts`).
 */
export interface Municipality {
  /** Nom affiché de la municipalité (ville). */
  readonly name: string;
  /** Id de région administrative (voir QUEBEC_REGIONS). */
  readonly regionId: string;
}

/** Normalise un nom de municipalité pour la comparaison (sans accents, en slug). */
export function normMunicipality(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Table de correspondance (nom normalisé → id de région) pour le reclassement. */
export function municipalityRegionMap(list: readonly Municipality[]): Map<string, string> {
  return new Map(
    list
      .filter((m) => m.name && m.regionId)
      .map((m) => [normMunicipality(m.name), m.regionId]),
  );
}
