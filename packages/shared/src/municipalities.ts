import municipalitiesRaw from "./municipalities.json";

/**
 * Table éditable **municipalité → région administrative**.
 *
 * La liste vit dans `packages/shared/src/municipalities.json`, **éditable depuis
 * la console d'administration** (onglet « Régions & municipalités » → publie le
 * fichier sur GitHub → redéploiement), exactement comme les commandites. À
 * l'export de l'instantané (`export:static`), toute offre dont la ville figure
 * ici est reclassée dans la bonne région — offres existantes comprises, sans
 * re-scraper. Aucun serveur d'API n'est requis (le fichier est committé).
 */
export interface Municipality {
  /** Nom affiché de la municipalité (ville). */
  readonly name: string;
  /** Id de région administrative (voir QUEBEC_REGIONS). */
  readonly regionId: string;
}

export const MUNICIPALITIES = municipalitiesRaw as readonly Municipality[];

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
export function municipalityRegionMap(
  list: readonly Municipality[] = MUNICIPALITIES,
): Map<string, string> {
  return new Map(
    list
      .filter((m) => m.name && m.regionId)
      .map((m) => [normMunicipality(m.name), m.regionId]),
  );
}
