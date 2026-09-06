/**
 * Historique de recrutement d'un employeur : points (date, offres trouvées)
 * issus des scrapes réussis, pour un mini-graphe sur la fiche.
 */
export interface HiringPoint {
  at: string;
  found: number;
}

export type HiringHistory = Record<string, HiringPoint[]>;

export const HIRING_HISTORY_MAX = 24;

/** Garde les N derniers points, triés du plus ancien au plus récent. */
export function collapseHiringPoints(
  points: HiringPoint[],
  max = HIRING_HISTORY_MAX,
): HiringPoint[] {
  return [...points]
    .filter((p) => Number.isFinite(p.found) && p.at)
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-max);
}

/**
 * Coordonnées SVG `x,y x,y …` pour une polyline. Axe Y inversé (0 en haut).
 * Si toutes les valeurs sont égales, la ligne est horizontale au milieu.
 */
export function sparklinePoints(
  values: number[],
  width = 180,
  height = 40,
  pad = 3,
): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = width - 2 * pad;
  const innerH = height - 2 * pad;
  return values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * innerW;
      const y = pad + (1 - (v - min) / span) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function hiringExtent(points: HiringPoint[]): { min: number; max: number } | undefined {
  if (points.length === 0) return undefined;
  const found = points.map((p) => p.found);
  return { min: Math.min(...found), max: Math.max(...found) };
}
