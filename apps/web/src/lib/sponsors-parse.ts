/**
 * Helpers purs des commandites (testables hors-ligne, sans `sponsors.json`).
 */

export type SponsorTier = "or" | "argent" | "bronze";

/** Offre Bronze : épinglée en tête des résultats jusqu'à `until` (inclus). */
export interface PinnedJob {
  readonly jobId: string;
  /** Fin d'épingle YYYY-MM-DD (inclus). Absent = jusqu'à retrait admin. */
  readonly until?: string;
}

/** Maximum d'offres épinglées visibles en tête de page. */
export const PINNED_MAX = 2;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayYmd(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Accepte `{ jobId, until? }` ou un id nu (rétrocompat). */
export function parsePinnedList(raw: unknown): PinnedJob[] {
  if (!Array.isArray(raw)) return [];
  const out: PinnedJob[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    let jobId = "";
    let until: string | undefined;
    if (typeof item === "string") {
      jobId = item.trim();
    } else if (item && typeof item === "object") {
      const rec = item as { jobId?: unknown; until?: unknown };
      jobId = typeof rec.jobId === "string" ? rec.jobId.trim() : "";
      const d = typeof rec.until === "string" ? rec.until.slice(0, 10) : "";
      if (DATE_RE.test(d)) until = d;
    }
    if (!jobId || seen.has(jobId)) continue;
    seen.add(jobId);
    out.push(until ? { jobId, until } : { jobId });
  }
  return out;
}

/** L'épingle est encore valable aujourd'hui (date locale). */
export function isPinnedActive(pin: PinnedJob, now = new Date()): boolean {
  const id = (pin.jobId ?? "").trim();
  if (!id) return false;
  const until = (pin.until ?? "").slice(0, 10);
  if (!until) return true;
  if (!DATE_RE.test(until)) return false;
  return until >= todayYmd(now);
}

/** Ids d'offres Bronze encore actives, dans l'ordre, plafonnés. */
export function activePinnedJobIds(
  pins: readonly PinnedJob[] = [],
  now = new Date(),
  max = PINNED_MAX,
): string[] {
  const ids: string[] = [];
  for (const pin of pins) {
    if (!isPinnedActive(pin, now)) continue;
    ids.push(pin.jobId.trim());
    if (ids.length >= max) break;
  }
  return ids;
}

/** Remonte les offres épinglées en tête (ordre des ids, sans doublon). */
export function pinJobsFirst<T extends { id: string }>(
  jobs: readonly T[],
  pinnedIds: readonly string[],
): T[] {
  if (!pinnedIds.length) return [...jobs];
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const seen = new Set<string>();
  const head: T[] = [];
  for (const id of pinnedIds) {
    const job = byId.get(id);
    if (!job || seen.has(id)) continue;
    head.push(job);
    seen.add(id);
  }
  const tail = jobs.filter((j) => !seen.has(j.id));
  return [...head, ...tail];
}

export function parseSponsorTier(raw: unknown): SponsorTier {
  return raw === "or" || raw === "bronze" ? raw : "argent";
}
