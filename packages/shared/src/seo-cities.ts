import { normMunicipality } from "./municipalities.js";
import type { Job } from "./types.js";

/**
 * Villes SEO à forte intention de recherche (« emplois construction Laval »,
 * « jobs Gatineau chantier »…). Pages `/emplois/ville/{id}`.
 */
export interface SeoCity {
  /** Slug d'URL (`laval`, `levis`…). */
  readonly id: string;
  /** Libellé affiché. */
  readonly label: string;
  /** Variantes de nom (sans accents) pour matcher `job.city` / `location`. */
  readonly aliases: readonly string[];
}

export const SEO_CITIES: readonly SeoCity[] = [
  { id: "montreal", label: "Montréal", aliases: ["montreal", "montréal", "ville-marie"] },
  { id: "quebec", label: "Québec", aliases: ["quebec", "québec", "sainte-foy", "ste-foy"] },
  { id: "laval", label: "Laval", aliases: ["laval"] },
  { id: "gatineau", label: "Gatineau", aliases: ["gatineau", "hull", "aylmer", "chelsea"] },
  { id: "longueuil", label: "Longueuil", aliases: ["longueuil", "saint-hubert", "st-hubert"] },
  { id: "levis", label: "Lévis", aliases: ["levis", "lévis"] },
  { id: "sherbrooke", label: "Sherbrooke", aliases: ["sherbrooke", "magog"] },
  {
    id: "trois-rivieres",
    label: "Trois-Rivières",
    aliases: ["trois-rivieres", "trois-rivières", "trois rivieres"],
  },
];

const BY_ID = new Map(SEO_CITIES.map((c) => [c.id, c]));

/** Ville SEO par slug d'URL. */
export function seoCityById(id: string): SeoCity | undefined {
  return BY_ID.get(id);
}

/** Ensemble des alias normalisés d'une ville SEO. */
function aliasSet(city: SeoCity): Set<string> {
  return new Set(city.aliases.map((a) => normMunicipality(a)));
}

/**
 * L'offre est-elle rattachée à cette ville SEO ?
 * Compare `city`, puis le premier segment de `location`.
 */
export function jobMatchesSeoCity(job: Pick<Job, "city" | "location">, city: SeoCity): boolean {
  const aliases = aliasSet(city);
  if (job.city && aliases.has(normMunicipality(job.city))) return true;
  const locCity = job.location?.split(/[,(]/)[0]?.trim();
  if (locCity && aliases.has(normMunicipality(locCity))) return true;
  // Cas « Québec (ville) » : `quebec` ne doit pas matcher toute location
  // « …, QC » — déjà couvert via le premier segment uniquement.
  return false;
}
