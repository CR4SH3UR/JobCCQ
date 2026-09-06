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
  /** 2e page carrières (ex. Jobillico en plus du site officiel). */
  careersUrl2?: string | null;
  method2?: string | null;
  region?: string | null;
  rbq?: string | null;
  scope?: string | null;
  sectors?: readonly string[] | null;
  verified?: boolean;
  enabled?: boolean;
  notes?: string | null;
}

const sameUrl = (a?: string | null, b?: string | null): boolean =>
  (a ?? "").trim().replace(/\/+$/, "").toLowerCase() === (b ?? "").trim().replace(/\/+$/, "").toLowerCase();

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
  const dropAsSecond =
    drop.careersUrl && !sameUrl(keep.careersUrl, drop.careersUrl) ? drop.careersUrl : undefined;
  return {
    ...keep,
    homepage: keep.homepage || drop.homepage,
    careersUrl: keep.careersUrl || drop.careersUrl,
    careersUrl2: keep.careersUrl2 || dropAsSecond || drop.careersUrl2 || undefined,
    method2: keep.method2 || (dropAsSecond ? drop.method : undefined) || drop.method2 || undefined,
    region: keep.region || drop.region,
    rbq: keep.rbq || drop.rbq,
    scope: keep.scope || drop.scope,
    sectors,
    verified: !!(keep.verified || drop.verified),
    enabled: keep.enabled !== false,
    notes,
  };
}
