/**
 * Fusion de deux fiches employeur : on garde `keep`, on absorbe `drop`.
 */
import { hasCustomScraper } from "./custom-scrapers.js";

export interface MergeableEmployer {
  id: string;
  name: string;
  homepage: string;
  careersUrl: string;
  method: string;
  region?: string | null;
  rbq?: string | null;
  scope?: string | null;
  sectors?: readonly string[] | null;
  verified?: boolean;
  enabled?: boolean;
  notes?: string | null;
}

/** Choisit l'id à conserver (scraper sur mesure > vérifié > plus d'offres). */
export function pickKeepEmployerId(
  a: MergeableEmployer,
  b: MergeableEmployer,
  jobs: { a: number; b: number } = { a: 0, b: 0 },
): string {
  const aC = hasCustomScraper(a.id);
  const bC = hasCustomScraper(b.id);
  if (aC && !bC) return a.id;
  if (bC && !aC) return b.id;
  if (a.verified && !b.verified) return a.id;
  if (b.verified && !a.verified) return b.id;
  if (jobs.a !== jobs.b) return jobs.a >= jobs.b ? a.id : b.id;
  return a.id;
}

/** Champs de `keep` complétés par `drop` (id / méthode de keep inchangés). */
export function mergeEmployerFields(keep: MergeableEmployer, drop: MergeableEmployer): MergeableEmployer {
  const sectors = [...new Set([...(keep.sectors ?? []), ...(drop.sectors ?? [])].filter(Boolean))];
  const notes = [keep.notes, drop.notes, `Fusionné depuis ${drop.id} (${drop.name})`]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join("\n");
  return {
    ...keep,
    homepage: keep.homepage || drop.homepage,
    careersUrl: keep.careersUrl || drop.careersUrl,
    region: keep.region || drop.region,
    rbq: keep.rbq || drop.rbq,
    scope: keep.scope || drop.scope,
    sectors,
    verified: !!(keep.verified || drop.verified),
    enabled: keep.enabled !== false,
    notes,
  };
}
