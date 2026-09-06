/**
 * Distances approximatives au Québec (centroïdes de région + grandes villes).
 * Suffisant pour « à moins de X km » et le tri par distance — pas un GPS.
 */
import { normMunicipality } from "./municipalities.js";
import { fsaOf, looksLikePostal, regionForFsa } from "./postal.js";
import type { Job } from "./types.js";

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Centroïdes des 17 régions administratives (+ replis). */
export const REGION_CENTROIDS: Readonly<Record<string, GeoPoint>> = {
  "bas-saint-laurent": { lat: 48.07, lng: -68.53 },
  "saguenay-lac-saint-jean": { lat: 48.43, lng: -71.07 },
  "capitale-nationale": { lat: 46.81, lng: -71.21 },
  mauricie: { lat: 46.35, lng: -72.55 },
  estrie: { lat: 45.4, lng: -71.9 },
  montreal: { lat: 45.5, lng: -73.57 },
  outaouais: { lat: 45.48, lng: -75.7 },
  "abitibi-temiscamingue": { lat: 48.23, lng: -79.02 },
  "cote-nord": { lat: 50.2, lng: -66.38 },
  "nord-du-quebec": { lat: 53.7, lng: -76.0 },
  "gaspesie-iles-de-la-madeleine": { lat: 48.83, lng: -64.48 },
  "chaudiere-appalaches": { lat: 46.55, lng: -70.9 },
  laval: { lat: 45.61, lng: -73.71 },
  lanaudiere: { lat: 46.03, lng: -73.44 },
  laurentides: { lat: 45.95, lng: -74.22 },
  monteregie: { lat: 45.38, lng: -73.1 },
  "centre-du-quebec": { lat: 46.05, lng: -72.2 },
};

/** Grandes villes (nom normalisé → coordonnées). */
const CITY_COORDS: Readonly<Record<string, GeoPoint>> = {
  montreal: { lat: 45.5017, lng: -73.5673 },
  quebec: { lat: 46.8139, lng: -71.208 },
  laval: { lat: 45.6066, lng: -73.7123 },
  gatineau: { lat: 45.4765, lng: -75.7013 },
  longueuil: { lat: 45.5312, lng: -73.5185 },
  sherbrooke: { lat: 45.4042, lng: -71.8929 },
  levis: { lat: 46.7382, lng: -71.2465 },
  saguenay: { lat: 48.4281, lng: -71.0685 },
  chicoutimi: { lat: 48.4281, lng: -71.0685 },
  jonquiere: { lat: 48.416, lng: -71.249 },
  "trois-rivieres": { lat: 46.3432, lng: -72.5477 },
  terrebonne: { lat: 45.7, lng: -73.647 },
  "saint-jean-sur-richelieu": { lat: 45.3071, lng: -73.2626 },
  brossard: { lat: 45.4564, lng: -73.4654 },
  repentigny: { lat: 45.7424, lng: -73.4501 },
  drummondville: { lat: 45.883, lng: -72.484 },
  "saint-jerome": { lat: 45.7804, lng: -74.0036 },
  granby: { lat: 45.4001, lng: -72.734 },
  blainville: { lat: 45.671, lng: -73.88 },
  "saint-hyacinthe": { lat: 45.6306, lng: -72.9568 },
  shawinigan: { lat: 46.5501, lng: -72.748 },
  rimouski: { lat: 48.4489, lng: -68.523 },
  chateauguay: { lat: 45.38, lng: -73.75 },
  "saint-eustache": { lat: 45.565, lng: -73.905 },
  victoriaville: { lat: 46.055, lng: -71.96 },
  "rouyn-noranda": { lat: 48.239, lng: -79.029 },
  "salaberry-de-valleyfield": { lat: 45.255, lng: -74.132 },
  alma: { lat: 48.55, lng: -71.65 },
  "val-dor": { lat: 48.097, lng: -77.797 },
  "sept-iles": { lat: 50.2, lng: -66.382 },
  "baie-comeau": { lat: 49.217, lng: -68.15 },
  matane: { lat: 48.844, lng: -67.531 },
  gaspe: { lat: 48.831, lng: -64.487 },
  "riviere-du-loup": { lat: 47.836, lng: -69.537 },
  "mont-laurier": { lat: 46.553, lng: -75.5 },
  "la tuque": { lat: 47.434, lng: -72.785 },
  amos: { lat: 48.572, lng: -78.116 },
  magog: { lat: 45.266, lng: -72.148 },
  mascouche: { lat: 45.75, lng: -73.6 },
  mirabel: { lat: 45.65, lng: -74.08 },
  "vaudreuil-dorion": { lat: 45.4, lng: -74.03 },
  "saint-georges": { lat: 46.122, lng: -70.67 },
  "sainte-therese": { lat: 45.639, lng: -73.827 },
  beloeil: { lat: 45.568, lng: -73.206 },
  boucherville: { lat: 45.591, lng: -73.453 },
  "thedford-mines": { lat: 46.094, lng: -71.305 },
  "thetford-mines": { lat: 46.094, lng: -71.305 },
  cowansville: { lat: 45.203, lng: -72.753 },
  joliette: { lat: 46.023, lng: -73.442 },
  "saint-bruno-de-montarville": { lat: 45.525, lng: -73.339 },
  candiac: { lat: 45.384, lng: -73.518 },
  "dollard-des-ormeaux": { lat: 45.494, lng: -73.824 },
  westmount: { lat: 45.487, lng: -73.598 },
  lachine: { lat: 45.446, lng: -73.676 },
  anjou: { lat: 45.607, lng: -73.555 },
  "cote-saint-luc": { lat: 45.468, lng: -73.67 },
  "sainte-foy": { lat: 46.78, lng: -71.28 },
  "charlesbourg": { lat: 46.86, lng: -71.27 },
  beauport: { lat: 46.86, lng: -71.19 },
};

const EARTH_KM = 6371;

/** Distance orthodromique en km. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function coordsForCity(city?: string | null): GeoPoint | undefined {
  if (!city) return undefined;
  return CITY_COORDS[normMunicipality(city)];
}

export function coordsForRegion(regionId?: string | null): GeoPoint | undefined {
  if (!regionId) return undefined;
  return REGION_CENTROIDS[regionId];
}

/** Ville si connue, sinon centroïde de région. */
export function coordsForJob(job: Pick<Job, "city" | "regionId">): GeoPoint | undefined {
  return coordsForCity(job.city) ?? coordsForRegion(job.regionId);
}

/**
 * Origine d'une recherche « près de » : code postal (FSA → région) ou nom de ville.
 */
export function originFromNear(raw?: string | null): GeoPoint | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (looksLikePostal(trimmed)) {
    const fsa = fsaOf(trimmed);
    if (!fsa) return undefined;
    const regionId = regionForFsa(fsa);
    return coordsForRegion(regionId);
  }
  return coordsForCity(trimmed) ?? undefined;
}

export const RADIUS_KM_OPTIONS = [25, 50, 100, 200] as const;

export function formatDistanceKm(km: number): string {
  if (km < 10) return `${km.toFixed(0)} km`;
  return `${Math.round(km)} km`;
}
