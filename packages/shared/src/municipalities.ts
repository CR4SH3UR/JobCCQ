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

/** Index (nom normalisé → municipalité) : donne à la fois le nom canonique et la région. */
export function municipalityIndex(list: readonly Municipality[]): Map<string, Municipality> {
  return new Map(
    list.filter((m) => m.name && m.regionId).map((m) => [normMunicipality(m.name), m]),
  );
}

/**
 * Cherche une valeur pour une ville dans une table indexée par nom normalisé.
 *
 * 1. Correspondance **exacte** sur le nom normalisé.
 * 2. À défaut, **repli** : on retire un qualificatif de comté/MRC en suffixe
 *    (« Saint-Donat-de-Montcalm » → « Saint-Donat », « Saint-André-de-Kamouraska »
 *    → « Saint-André »…) — fréquent dans les offres, qui écrivent le nom usuel
 *    long alors que la table (MAMH) porte le nom officiel court — et on réessaie.
 *    Le repli n'agit que si le nom complet est absent, donc il ne peut pas
 *    « voler » une municipalité qui existe telle quelle.
 */
function lookupWithFallback<T>(map: ReadonlyMap<string, T>, city: string): T | undefined {
  const key = normMunicipality(city ?? "");
  if (!key) return undefined;
  const exact = map.get(key);
  if (exact !== undefined) return exact;
  const stripped = key.replace(/-(?:de|du|des|d)-[a-z0-9-]+$/, "");
  if (stripped && stripped !== key) return map.get(stripped);
  return undefined;
}

/** Région d'une ville (id) via la table nom normalisé → région. Voir lookupWithFallback. */
export function regionForCity(map: ReadonlyMap<string, string>, city: string): string | undefined {
  return lookupWithFallback(map, city);
}

/** Municipalité (nom canonique + région) d'une ville via l'index. Voir lookupWithFallback. */
export function municipalityByCity(
  map: ReadonlyMap<string, Municipality>,
  city: string,
): Municipality | undefined {
  return lookupWithFallback(map, city);
}
