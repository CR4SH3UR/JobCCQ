import type { Job } from "./types.js";
import { labelForSalaryPeriod } from "./taxonomy.js";

/** Semaine type construction (35 h) × 52 semaines. */
export const HOURS_PER_YEAR = 35 * 52;

const nf = new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 });

export type SalarySlice = Pick<Job, "salaryMin" | "salaryMax" | "salaryPeriod">;

/** Convertit un montant vers un annuel approximatif. */
export function toAnnual(amount: number, period?: Job["salaryPeriod"]): number {
  switch (period) {
    case "heure":
      return amount * HOURS_PER_YEAR;
    case "semaine":
      return amount * 52;
    case "mois":
      return amount * 12;
    default:
      return amount;
  }
}

/** Convertit un montant vers un horaire approximatif. */
export function toHourly(amount: number, period?: Job["salaryPeriod"]): number {
  return Math.round(toAnnual(amount, period) / HOURS_PER_YEAR);
}

/** Salaire comparable (on ramène tout à un montant annuel approximatif). */
export function annualizedSalary(job: SalarySlice): number | undefined {
  const base = job.salaryMax ?? job.salaryMin;
  if (base == null) return undefined;
  return toAnnual(base, job.salaryPeriod);
}

function money(n: number): string {
  return `${nf.format(n)}\u00a0$`;
}

function range(min?: number, max?: number): string {
  if (min != null && max != null && min !== max) return `${money(min)}\u00a0–\u00a0${money(max)}`;
  return money((max ?? min)!);
}

/**
 * Fourchette salariale avec équivalent horaire **et** annuel pour comparer.
 * Ex. « 35 $ / heure (≈ 63 700 $ / an) ».
 */
export function formatSalary(job: SalarySlice): string | null {
  const { salaryMin, salaryMax, salaryPeriod } = job;
  if (salaryMin == null && salaryMax == null) return null;
  const period = labelForSalaryPeriod(salaryPeriod) ?? "";
  const primary = period ? `${range(salaryMin, salaryMax)} ${period}` : range(salaryMin, salaryMax);
  if (!salaryPeriod) return primary;

  const conv = (n: number) => (salaryPeriod === "heure" ? toAnnual(n, "heure") : toHourly(n, salaryPeriod));
  const otherPeriod = salaryPeriod === "heure" ? "annee" : "heure";
  const otherLabel = labelForSalaryPeriod(otherPeriod) ?? "";
  const cMin = salaryMin != null ? conv(salaryMin) : undefined;
  const cMax = salaryMax != null ? conv(salaryMax) : undefined;
  return `${primary} (≈ ${range(cMin, cMax)} ${otherLabel})`;
}
