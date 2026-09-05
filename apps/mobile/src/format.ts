/**
 * Aides de formatage pour l'affichage (salaire, date relative, initiales).
 * Équivalent RN de apps/web/src/lib/format.ts — mêmes règles, même sortie.
 */
import { labelForSalaryPeriod, type Job } from "./shared";

const HOURS_PER_YEAR = 35 * 52;
const nf = new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 });

function toAnnual(amount: number, period?: Job["salaryPeriod"]): number {
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

function toHourly(amount: number, period?: Job["salaryPeriod"]): number {
  return Math.round(toAnnual(amount, period) / HOURS_PER_YEAR);
}

function money(n: number): string {
  return `${nf.format(n)} $`;
}

function range(min?: number, max?: number): string {
  if (min != null && max != null && min !== max) return `${money(min)} – ${money(max)}`;
  return money((max ?? min)!);
}

/** Fourchette salariale avec équivalent horaire et annuel. */
export function formatSalary(
  job: Pick<Job, "salaryMin" | "salaryMax" | "salaryPeriod">,
): string | null {
  const { salaryMin, salaryMax, salaryPeriod } = job;
  if (salaryMin == null && salaryMax == null) return null;
  const period = labelForSalaryPeriod(salaryPeriod) ?? "";
  const primary = period ? `${range(salaryMin, salaryMax)} ${period}` : range(salaryMin, salaryMax);
  if (!salaryPeriod) return primary;
  const conv = (n: number) => (salaryPeriod === "heure" ? toAnnual(n, "heure") : toHourly(n, salaryPeriod));
  const otherLabel = labelForSalaryPeriod(salaryPeriod === "heure" ? "annee" : "heure") ?? "";
  const cMin = salaryMin != null ? conv(salaryMin) : undefined;
  const cMax = salaryMax != null ? conv(salaryMax) : undefined;
  return `${primary} (≈ ${range(cMin, cMax)} ${otherLabel})`;
}

/** Date relative en français, ex. « il y a 3 jours ». */
export function timeAgo(iso?: string): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const diff = Date.now() - t;
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) {
    const hours = Math.floor(diff / 3_600_000);
    if (hours <= 0) return "à l'instant";
    return `il y a ${hours} h`;
  }
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} jours`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  return `il y a ${Math.floor(days / 30)} mois`;
}

/** Initiales d'une entreprise, pour l'avatar de repli (ex. « Desjardins » → « D »). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
