import type { Job } from "@jobccq/shared";

/** Longueur de l'extrait dans `jobs.json` (voir export-static CLIENT_DESC_MAX). */
const CLIENT_DESC_MAX = 240;

/** Extrait client tronqué (ellipse + ~240 car.), pas la fiche complète. */
export function looksTruncatedExcerpt(text?: string | null): boolean {
  const d = text ?? "";
  return d.endsWith("…") && d.length <= CLIENT_DESC_MAX;
}

/**
 * Superpose l'offre « live » (instantané client + overlay) sur la fiche SSG
 * sans écraser une description complète par l'extrait de 240 caractères.
 */
export function mergeLiveJob(seed: Job | null | undefined, live: Job | null | undefined): Job | null {
  if (!seed && !live) return null;
  if (!live) return seed ?? null;
  if (!seed) return live;
  const liveTrunc = looksTruncatedExcerpt(live.description);
  const seedTrunc = looksTruncatedExcerpt(seed.description);
  const description =
    liveTrunc && !seedTrunc ? seed.description : (live.description ?? seed.description);
  return { ...seed, ...live, description };
}
