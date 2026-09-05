import type { Municipality } from "./municipalities.js";
import { municipalityByCity, municipalityIndex } from "./municipalities.js";

/**
 * Code postal canadien → région administrative du Québec.
 *
 * On utilise le **FSA** (3 premiers caractères, ex. H2X). Table best-effort :
 * les agglomérations sont précises ; les FSA ruraux (G0 / J0) suivent le
 * découpage habituel Canada Post. Un FSA hors Québec tombe sur `canada-autre`.
 */

export interface NearMeHit {
  regionId: string;
  via: "postal" | "city";
  /** FSA normalisé (ex. H2X), si la requête était un code postal. */
  fsa?: string;
  /** Nom canonique de la municipalité, si la requête était une ville. */
  city?: string;
}

/** Compacte un code postal (espaces/tirets ignorés, majuscules). */
export function compactPostal(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

/** FSA (3 caractères) d'une saisie, ou `undefined` si ce n'est pas un CP canadien. */
export function fsaOf(raw: string): string | undefined {
  const c = compactPostal(raw);
  if (c.length < 3) return undefined;
  const fsa = c.slice(0, 3);
  // Lettres interdites en 1re position : D F I O Q U W Z.
  if (!/^[ABCEGHJ-NPRSTVXY]\d[A-Z]$/.test(fsa)) return undefined;
  return fsa;
}

/** La saisie ressemble-t-elle à un code postal (FSA ou CPA complet) ? */
export function looksLikePostal(raw: string): boolean {
  const c = compactPostal(raw);
  return /^[ABCEGHJ-NPRSTVXY]\d[A-Z](\d[A-Z]\d)?$/.test(c);
}

/**
 * Préfixes FSA → région. Le plus long préfixe gagne (H7 avant H, G7A avant G7).
 * Hors G/H/J : reste du Canada.
 */
const FSA_PREFIXES: readonly [string, string][] = [
  // Montréal / Laval
  ["H7", "laval"],
  ["H0M", "monteregie"],
  ["H", "montreal"],

  // Capitale-Nationale
  ["G1", "capitale-nationale"],
  ["G2", "capitale-nationale"],
  ["G3", "capitale-nationale"],
  ["G5A", "capitale-nationale"],

  // Est du Québec (G4–G5) — trop mélangé pour un préfixe à 2 lettres
  ["G4R", "cote-nord"],
  ["G4S", "cote-nord"],
  ["G4T", "gaspesie-iles-de-la-madeleine"],
  ["G4V", "gaspesie-iles-de-la-madeleine"],
  ["G4W", "bas-saint-laurent"],
  ["G4X", "gaspesie-iles-de-la-madeleine"],
  ["G4Z", "cote-nord"],
  ["G5B", "cote-nord"],
  ["G5C", "gaspesie-iles-de-la-madeleine"],
  ["G5H", "bas-saint-laurent"],
  ["G5J", "bas-saint-laurent"],
  ["G5L", "bas-saint-laurent"],
  ["G5M", "bas-saint-laurent"],
  ["G5N", "bas-saint-laurent"],
  ["G5R", "bas-saint-laurent"],
  ["G5T", "bas-saint-laurent"],
  ["G5V", "bas-saint-laurent"],
  ["G5X", "chaudiere-appalaches"],
  ["G5Y", "chaudiere-appalaches"],
  ["G5Z", "chaudiere-appalaches"],

  // Chaudière-Appalaches / Centre-du-Québec / Estrie (G6)
  ["G6A", "chaudiere-appalaches"],
  ["G6B", "estrie"],
  ["G6C", "chaudiere-appalaches"],
  ["G6D", "chaudiere-appalaches"],
  ["G6E", "chaudiere-appalaches"],
  ["G6G", "chaudiere-appalaches"],
  ["G6H", "chaudiere-appalaches"],
  ["G6J", "chaudiere-appalaches"],
  ["G6K", "chaudiere-appalaches"],
  ["G6P", "centre-du-quebec"],
  ["G6R", "centre-du-quebec"],
  ["G6S", "centre-du-quebec"],
  ["G6T", "centre-du-quebec"],
  ["G6V", "chaudiere-appalaches"],
  ["G6W", "chaudiere-appalaches"],
  ["G6X", "chaudiere-appalaches"],
  ["G6Y", "chaudiere-appalaches"],
  ["G6Z", "chaudiere-appalaches"],
  ["G7A", "chaudiere-appalaches"], // Saint-Nicolas / Lévis
  ["G7", "saguenay-lac-saint-jean"],

  // Saguenay / Mauricie / Nord-du-Québec (G8–G9)
  ["G8A", "saguenay-lac-saint-jean"],
  ["G8B", "saguenay-lac-saint-jean"],
  ["G8C", "saguenay-lac-saint-jean"],
  ["G8E", "saguenay-lac-saint-jean"],
  ["G8G", "saguenay-lac-saint-jean"],
  ["G8H", "saguenay-lac-saint-jean"],
  ["G8J", "saguenay-lac-saint-jean"],
  ["G8K", "saguenay-lac-saint-jean"],
  ["G8L", "saguenay-lac-saint-jean"],
  ["G8M", "saguenay-lac-saint-jean"],
  ["G8N", "saguenay-lac-saint-jean"],
  ["G8P", "nord-du-quebec"],
  ["G8T", "mauricie"],
  ["G8V", "mauricie"],
  ["G8W", "mauricie"],
  ["G8Y", "mauricie"],
  ["G8Z", "mauricie"],
  ["G9", "mauricie"],

  // Ruraux G0
  ["G0A", "capitale-nationale"],
  ["G0C", "gaspesie-iles-de-la-madeleine"],
  ["G0E", "gaspesie-iles-de-la-madeleine"],
  ["G0G", "cote-nord"],
  ["G0H", "cote-nord"],
  ["G0J", "gaspesie-iles-de-la-madeleine"],
  ["G0K", "bas-saint-laurent"],
  ["G0L", "bas-saint-laurent"],
  ["G0M", "chaudiere-appalaches"],
  ["G0N", "chaudiere-appalaches"],
  ["G0P", "centre-du-quebec"],
  ["G0R", "chaudiere-appalaches"],
  ["G0S", "chaudiere-appalaches"],
  ["G0T", "cote-nord"],
  ["G0V", "saguenay-lac-saint-jean"],
  ["G0W", "saguenay-lac-saint-jean"],
  ["G0X", "mauricie"],
  ["G0Y", "chaudiere-appalaches"],
  ["G0Z", "centre-du-quebec"],

  // Estrie / Centre-du-Québec / Montérégie (J1–J4)
  ["J1", "estrie"],
  ["J2A", "centre-du-quebec"],
  ["J2B", "centre-du-quebec"],
  ["J2C", "centre-du-quebec"],
  ["J2E", "centre-du-quebec"],
  ["J2G", "monteregie"],
  ["J2H", "monteregie"],
  ["J2J", "monteregie"],
  ["J2K", "monteregie"],
  ["J2L", "monteregie"],
  ["J2N", "monteregie"],
  ["J2R", "monteregie"],
  ["J2S", "monteregie"],
  ["J2T", "monteregie"],
  ["J2W", "monteregie"],
  ["J2X", "monteregie"],
  ["J2Y", "monteregie"],
  ["J3T", "centre-du-quebec"],
  ["J3", "monteregie"],
  ["J4", "monteregie"],

  // Couronne nord / Montérégie (J5–J7)
  ["J5A", "monteregie"],
  ["J5B", "monteregie"],
  ["J5C", "monteregie"],
  ["J5K", "laurentides"],
  ["J5L", "laurentides"],
  ["J5M", "lanaudiere"],
  ["J5R", "monteregie"],
  ["J5T", "lanaudiere"],
  ["J5V", "mauricie"],
  ["J5W", "lanaudiere"],
  ["J5X", "lanaudiere"],
  ["J5Y", "lanaudiere"],
  ["J5Z", "lanaudiere"],
  ["J6A", "lanaudiere"],
  ["J6E", "lanaudiere"],
  ["J6J", "monteregie"],
  ["J6K", "monteregie"],
  ["J6N", "monteregie"],
  ["J6R", "monteregie"],
  ["J6S", "monteregie"],
  ["J6T", "monteregie"],
  ["J6V", "lanaudiere"],
  ["J6W", "lanaudiere"],
  ["J6X", "lanaudiere"],
  ["J6Y", "lanaudiere"],
  ["J6Z", "lanaudiere"],
  ["J7K", "lanaudiere"],
  ["J7L", "lanaudiere"],
  ["J7V", "monteregie"],
  ["J7W", "monteregie"],
  ["J7X", "monteregie"],
  ["J7", "laurentides"],

  // Outaouais / Laurentides / Abitibi (J8–J9)
  ["J8C", "laurentides"],
  ["J8E", "laurentides"],
  ["J8G", "laurentides"],
  ["J8H", "laurentides"],
  ["J8", "outaouais"],
  ["J9A", "outaouais"],
  ["J9B", "outaouais"],
  ["J9E", "outaouais"],
  ["J9H", "outaouais"],
  ["J9J", "outaouais"],
  ["J9L", "laurentides"],
  ["J9P", "abitibi-temiscamingue"],
  ["J9T", "abitibi-temiscamingue"],
  ["J9V", "abitibi-temiscamingue"],
  ["J9X", "abitibi-temiscamingue"],
  ["J9Y", "abitibi-temiscamingue"],
  ["J9Z", "abitibi-temiscamingue"],

  // Ruraux J0
  ["J0A", "centre-du-quebec"],
  ["J0B", "estrie"],
  ["J0C", "centre-du-quebec"],
  ["J0E", "monteregie"],
  ["J0G", "centre-du-quebec"],
  ["J0H", "monteregie"],
  ["J0J", "monteregie"],
  ["J0K", "lanaudiere"],
  ["J0L", "monteregie"],
  ["J0M", "nord-du-quebec"],
  ["J0N", "laurentides"],
  ["J0P", "monteregie"],
  ["J0R", "laurentides"],
  ["J0S", "monteregie"],
  ["J0T", "laurentides"],
  ["J0V", "laurentides"],
  ["J0W", "laurentides"],
  ["J0X", "outaouais"],
  ["J0Y", "abitibi-temiscamingue"],
  ["J0Z", "abitibi-temiscamingue"],
];

const FSA_SORTED = [...FSA_PREFIXES].sort((a, b) => b[0].length - a[0].length);

/** Région administrative pour un FSA (ex. `H2X`). */
export function regionForFsa(fsa: string): string | undefined {
  const u = fsa.trim().toUpperCase();
  if (u.length < 1) return undefined;
  const letter = u[0]!;
  if (letter !== "G" && letter !== "H" && letter !== "J") {
    if (/^[ABCEKLMNPRSTVXY]$/.test(letter)) return "canada-autre";
    return undefined;
  }
  for (const [prefix, region] of FSA_SORTED) {
    if (u.startsWith(prefix)) return region;
  }
  return undefined;
}

/**
 * Résout une saisie « près de chez moi » : code postal (FSA) ou nom de ville
 * via l'index des municipalités. `null` si rien n'est reconnu.
 */
export function resolveNearMe(
  raw: string,
  municipalities: readonly Municipality[],
): NearMeHit | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (looksLikePostal(trimmed)) {
    const fsa = fsaOf(trimmed);
    if (!fsa) return null;
    const regionId = regionForFsa(fsa);
    if (!regionId) return null;
    return { regionId, via: "postal", fsa };
  }

  const hit = municipalityByCity(municipalityIndex(municipalities), trimmed);
  if (!hit) return null;
  return { regionId: hit.regionId, via: "city", city: hit.name };
}
