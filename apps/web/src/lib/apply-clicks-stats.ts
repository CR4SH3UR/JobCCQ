/**
 * Agrégation des clics « Postuler » (pure, testable hors-ligne).
 */
export interface ApplyClickEvent {
  jobId: string;
  sourceId: string;
  title: string;
  at: number;
}

export interface ApplyClickStats {
  total: number;
  bySource: { sourceId: string; count: number }[];
  byJob: { jobId: string; sourceId: string; title: string; count: number }[];
}

export function summarizeApplyClicks(events: ApplyClickEvent[]): ApplyClickStats {
  const sources = new Map<string, number>();
  const jobs = new Map<string, { jobId: string; sourceId: string; title: string; count: number }>();
  for (const e of events) {
    sources.set(e.sourceId, (sources.get(e.sourceId) ?? 0) + 1);
    const prev = jobs.get(e.jobId);
    if (prev) prev.count += 1;
    else jobs.set(e.jobId, { jobId: e.jobId, sourceId: e.sourceId, title: e.title, count: 1 });
  }
  const byCount = (a: { count: number }, b: { count: number }) => b.count - a.count;
  return {
    total: events.length,
    bySource: [...sources.entries()]
      .map(([sourceId, count]) => ({ sourceId, count }))
      .sort(byCount),
    byJob: [...jobs.values()].sort(byCount),
  };
}
