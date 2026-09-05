export const FAILING_ALERT_DAYS = 3;

export type RunSlice = {
  sourceId: string;
  status: string;
  at: string | null;
  error?: string;
};

export type FailingSource = {
  sourceId: string;
  name: string;
  error?: string;
  lastAt: string | null;
  lastSuccessAt: string | null;
  daysSinceSuccess: number | null;
};

function daysBetween(fromIso: string | null | undefined, now: number): number | null {
  if (!fromIso) return null;
  const t = Date.parse(fromIso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

/**
 * Sources dont le **dernier** run est en erreur, avec le nombre de jours
 * depuis le dernier succès (ou depuis l'échec s'il n'y a jamais eu de succès).
 */
export function failingScrapers(
  latest: RunSlice[],
  lastSuccess: Map<string, string>,
  names: Record<string, string> = {},
  now = Date.now(),
): FailingSource[] {
  const seen = new Set<string>();
  const out: FailingSource[] = [];
  for (const r of latest) {
    if (r.status !== "error" || seen.has(r.sourceId)) continue;
    seen.add(r.sourceId);
    const ok = lastSuccess.get(r.sourceId) ?? null;
    out.push({
      sourceId: r.sourceId,
      name: names[r.sourceId] ?? r.sourceId,
      error: r.error,
      lastAt: r.at,
      lastSuccessAt: ok,
      daysSinceSuccess: daysBetween(ok ?? r.at, now),
    });
  }
  return out.sort((a, b) => (b.daysSinceSuccess ?? 0) - (a.daysSinceSuccess ?? 0));
}
