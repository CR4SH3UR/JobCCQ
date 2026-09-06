/**
 * Taux horaires **compagnon**, secteur institutionnel et commercial (annexe C),
 * en vigueur le 26 avril 2026. Source publique SQI / conventions CCQ 2025-2029.
 * Ce n'est pas un bulletin de paie : les annexes (Baie-James, résidentiel,
 * primes) peuvent différer. Lien officiel : `CCQ_SALARY_URL`.
 */
import { ccqTradeOf } from "./ccq.js";
import { HOURS_PER_YEAR, toAnnual, type SalarySlice } from "./salary.js";

export const CCQ_SALARY_URL = "https://www.ccq.org/fr-CA/avantages-sociaux/salaire-taux";
export const CCQ_WAGE_AS_OF = "2026-04-26";
export const CCQ_WAGE_SECTOR = "institutionnel et commercial";

/** Taux compagnon ICI ($ / h), clé = id `CCQ_TRADES`. */
export const CCQ_WAGE_ICI_COMPAGNON: Readonly<Record<string, number>> = {
  "briqueteur-macon": 49.57,
  calorifugeur: 50.79,
  carreleur: 50.12,
  "charpentier-menuisier": 50.16,
  chaudronnier: 50.79,
  "cimentier-applicateur": 48.55,
  couvreur: 51.2,
  electricien: 50.79,
  ferblantier: 50.79,
  ferrailleur: 51.31,
  frigoriste: 50.79,
  grutier: 50.79,
  manoeuvre: 40.19,
  "manoeuvre-specialise": 40.83,
  "mecanicien-ascenseur": 56.7,
  "mecanicien-protection-incendie": 50.79,
  "mecanicien-chantier": 50.79,
  "monteur-acier": 51.31,
  "monteur-vitrier": 49.6,
  "operateur-equipement-lourd": 46.69,
  peintre: 47.39,
  platrier: 48.26,
  "poseur-revetements-souples": 49.07,
  "poseur-systemes-interieurs": 50.16,
  tuyauteur: 50.79,
  soudeur: 47.4,
};

const nfH = new Intl.NumberFormat("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatCcqHourly(n: number): string {
  return `${nfH.format(n)}\u00a0$ / h`;
}

export type CcqWageVsOffer = "below" | "near" | "above";

export interface CcqWageRef {
  tradeId: string;
  tradeLabel: string;
  hourly: number;
  sector: string;
  asOf: string;
  isolatedNote: boolean;
  vsOffer?: CcqWageVsOffer;
}

const ISOLATED_REGIONS = new Set(["nord-du-quebec", "cote-nord"]);

function offerHourly(job: SalarySlice): number | undefined {
  const base = job.salaryMax ?? job.salaryMin;
  if (base == null) return undefined;
  if (job.salaryPeriod === "heure") return base;
  return toAnnual(base, job.salaryPeriod) / HOURS_PER_YEAR;
}

function vsOffer(offer: number, grid: number): CcqWageVsOffer {
  const delta = offer / grid - 1;
  if (Math.abs(delta) <= 0.05) return "near";
  return offer < grid ? "below" : "above";
}

/** Grille CCQ compagnon ICI pour un intitulé, si le métier a un taux connu. */
export function ccqWageForJob(
  title?: string | null,
  job?: SalarySlice & { regionId?: string },
): CcqWageRef | undefined {
  const trade = ccqTradeOf(title);
  if (!trade) return undefined;
  const hourly = CCQ_WAGE_ICI_COMPAGNON[trade.id];
  if (hourly == null) return undefined;
  const offer = job ? offerHourly(job) : undefined;
  return {
    tradeId: trade.id,
    tradeLabel: trade.label,
    hourly,
    sector: CCQ_WAGE_SECTOR,
    asOf: CCQ_WAGE_AS_OF,
    isolatedNote: !!(job?.regionId && ISOLATED_REGIONS.has(job.regionId)),
    vsOffer: offer != null ? vsOffer(offer, hourly) : undefined,
  };
}
