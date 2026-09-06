/**
 * Rapport des 7 derniers jours (idée 86) : nouvelles offres + top employeurs.
 */
import { ccqTradeOf } from "./ccq.js";
import { rankHiringCompanies } from "./filters.js";
import { labelForRegion } from "./taxonomy.js";
import type { Job } from "./types.js";

export const WEEKLY_REPORT_DAYS = 7;

export type WeeklyCount = { id: string; label: string; count: number };

export type WeeklyReport = {
  generatedAt: string;
  days: number;
  newJobs: number;
  totalJobs: number;
  topEmployers: WeeklyCount[];
  topRegions: WeeklyCount[];
  topTrades: WeeklyCount[];
};

export function jobRecencyMs(job: Pick<Job, "postedAt" | "scrapedAt">): number {
  const t = Date.parse(job.postedAt ?? job.scrapedAt ?? "");
  return Number.isFinite(t) ? t : 0;
}

export function jobsInWindow(
  jobs: readonly Job[],
  nowMs: number,
  days = WEEKLY_REPORT_DAYS,
): Job[] {
  const since = nowMs - days * 86_400_000;
  return jobs.filter((j) => jobRecencyMs(j) >= since);
}

function topCounts(pairs: Iterable<[string, { label: string; n: number }]>, limit: number): WeeklyCount[] {
  return [...pairs]
    .map(([id, v]) => ({ id, label: v.label, count: v.n }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"))
    .slice(0, limit);
}

export function buildWeeklyReport(
  jobs: readonly Job[],
  now: Date | number = new Date(),
  days = WEEKLY_REPORT_DAYS,
): WeeklyReport {
  const nowMs = typeof now === "number" ? now : now.getTime();
  const fresh = jobsInWindow(jobs, nowMs, days);
  const regions = new Map<string, { label: string; n: number }>();
  const trades = new Map<string, { label: string; n: number }>();
  for (const job of fresh) {
    if (job.regionId) {
      const prev = regions.get(job.regionId) ?? { label: labelForRegion(job.regionId) ?? job.regionId, n: 0 };
      prev.n += 1;
      regions.set(job.regionId, prev);
    }
    const trade = ccqTradeOf(job.title);
    if (trade) {
      const prev = trades.get(trade.id) ?? { label: trade.label, n: 0 };
      prev.n += 1;
      trades.set(trade.id, prev);
    }
  }
  return {
    generatedAt: new Date(nowMs).toISOString(),
    days,
    newJobs: fresh.length,
    totalJobs: jobs.length,
    topEmployers: rankHiringCompanies(fresh).slice(0, 10).map((c) => ({
      id: c.sources[0] ?? c.company,
      label: c.company,
      count: c.openings,
    })),
    topRegions: topCounts(regions, 8),
    topTrades: topCounts(trades, 8),
  };
}
