/**
 * Guide salarial (idée 83) : médiane observée sur les offres + grille CCQ.
 */
import { CCQ_TRADES, ccqTradeOf } from "./ccq.js";
import { CCQ_WAGE_ICI_COMPAGNON } from "./ccq-wages.js";
import { HOURS_PER_YEAR, toAnnual, type SalarySlice } from "./salary.js";
import { labelForRegion } from "./taxonomy.js";
import type { Job } from "./types.js";

export const SALARY_GUIDE_MIN_SAMPLE = 3;

const SEO_EXCLUDED_REGIONS = new Set(["teletravail", "canada-autre", "autre"]);

export function jobHourly(job: SalarySlice): number | undefined {
  const base = job.salaryMax ?? job.salaryMin;
  if (base == null) return undefined;
  if (job.salaryPeriod === "heure") return base;
  return toAnnual(base, job.salaryPeriod) / HOURS_PER_YEAR;
}

/** Médiane d'une liste déjà triée, ou on trie une copie. */
export function median(values: readonly number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export type SalaryGuideRegion = {
  regionId: string;
  label: string;
  median: number | undefined;
  sample: number;
};

export type SalaryGuideRow = {
  tradeId: string;
  tradeLabel: string;
  ccqHourly: number | undefined;
  observedMedian: number | undefined;
  sample: number;
  regions: SalaryGuideRegion[];
};

export function buildSalaryGuide(jobs: readonly Job[]): SalaryGuideRow[] {
  const byTrade = new Map<string, number[]>();
  const byTradeRegion = new Map<string, Map<string, number[]>>();

  for (const job of jobs) {
    const hourly = jobHourly(job);
    if (hourly == null || !Number.isFinite(hourly) || hourly <= 0) continue;
    const trade = ccqTradeOf(job.title);
    if (!trade) continue;
    (byTrade.get(trade.id) ?? byTrade.set(trade.id, []).get(trade.id)!).push(hourly);
    const regionId = job.regionId?.trim();
    if (!regionId || SEO_EXCLUDED_REGIONS.has(regionId)) continue;
    const regions = byTradeRegion.get(trade.id) ?? byTradeRegion.set(trade.id, new Map()).get(trade.id)!;
    (regions.get(regionId) ?? regions.set(regionId, []).get(regionId)!).push(hourly);
  }

  const ids = new Set<string>([...Object.keys(CCQ_WAGE_ICI_COMPAGNON), ...byTrade.keys()]);
  const rows: SalaryGuideRow[] = [];
  for (const trade of CCQ_TRADES) {
    if (!ids.has(trade.id)) continue;
    const samples = byTrade.get(trade.id) ?? [];
    const regionMap = byTradeRegion.get(trade.id) ?? new Map();
    const regions: SalaryGuideRegion[] = [...regionMap.entries()]
      .map(([regionId, vals]) => ({
        regionId,
        label: labelForRegion(regionId) ?? regionId,
        median: vals.length >= SALARY_GUIDE_MIN_SAMPLE ? median(vals) : undefined,
        sample: vals.length,
      }))
      .sort((a, b) => b.sample - a.sample || a.label.localeCompare(b.label, "fr"));
    rows.push({
      tradeId: trade.id,
      tradeLabel: trade.label,
      ccqHourly: CCQ_WAGE_ICI_COMPAGNON[trade.id],
      observedMedian: samples.length >= SALARY_GUIDE_MIN_SAMPLE ? median(samples) : undefined,
      sample: samples.length,
      regions,
    });
  }
  return rows.sort((a, b) => b.sample - a.sample || a.tradeLabel.localeCompare(b.tradeLabel, "fr"));
}

export function salaryGuideByTrade(rows: readonly SalaryGuideRow[], tradeId: string): SalaryGuideRow | undefined {
  return rows.find((r) => r.tradeId === tradeId);
}
