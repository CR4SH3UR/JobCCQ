/**
 * Accès aux données **au moment du build** (composants serveur / SSG).
 *
 * Contrairement à `data.ts` (qui `fetch` l'instantané côté navigateur), ce
 * module lit l'instantané directement sur le disque : il alimente
 * `generateStaticParams`, les métadonnées et le rendu des pages de détail
 * pré-générées. À n'importer que depuis des composants serveur.
 *
 * On privilégie `data/jobs.full.json` (descriptions **entières**) pour que les
 * pages de détail et le JSON-LD affichent le texte complet ; à défaut (build
 * hors Turso), on retombe sur l'instantané client `public/data/jobs.json`
 * (descriptions tronquées).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aggregateMarketHistory,
  buildSalaryGuide,
  buildWeeklyReport,
  CCQ_TRADES,
  ccqTradeOf,
  DISABLED_SOURCE_IDS,
  getEmployer,
  labelForRegion,
  QUEBEC_REGIONS,
  rankHiringCompanies,
  salaryGuideByTrade,
  tensionPer1000,
  workforceFor,
  type DiscoveredEmployer,
  type HiringCompany,
  type HiringHistory,
  type HiringPoint,
  type Job,
  type SalaryGuideRow,
  type WeeklyReport,
} from "@jobccq/shared";

let cache: Job[] | null = null;

/** Toutes les offres de l'instantané (sources désactivées exclues). */
export function allJobs(): Job[] {
  if (!cache) {
    const fullPath = join(process.cwd(), "data", "jobs.full.json");
    const clientPath = join(process.cwd(), "public", "data", "jobs.json");
    const path = existsSync(fullPath) ? fullPath : clientPath;
    const jobs = JSON.parse(readFileSync(path, "utf8")) as Job[];
    cache = DISABLED_SOURCE_IDS.size
      ? jobs.filter((j) => !DISABLED_SOURCE_IDS.has(j.sourceId))
      : jobs;
  }
  return cache;
}

export function jobById(id: string): Job | undefined {
  return allJobs().find((j) => j.id === id);
}

const byRecent = (a: Job, b: Job) =>
  (b.postedAt ?? b.scrapedAt).localeCompare(a.postedAt ?? a.scrapedAt);

/** Régions (hors télétravail / hors-Québec / autre) exclues des pages SEO. */
const SEO_EXCLUDED_REGIONS = new Set(["teletravail", "canada-autre", "autre"]);

/** Offres d'une région (id de QUEBEC_REGIONS), les plus récentes d'abord. */
export function jobsByRegion(regionId: string): Job[] {
  return allJobs()
    .filter((j) => j.regionId === regionId)
    .sort(byRecent);
}

/** Offres d'un métier CCQ (id de CCQ_TRADES), les plus récentes d'abord. */
export function jobsByTrade(tradeId: string): Job[] {
  return allJobs()
    .filter((j) => ccqTradeOf(j.title)?.id === tradeId)
    .sort(byRecent);
}

export interface FacetLink {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

/** Régions ayant au moins une offre (pour les pages/index SEO), triées par volume. */
export function regionsWithCounts(): FacetLink[] {
  const counts = new Map<string, number>();
  for (const j of allJobs()) {
    if (!j.regionId || SEO_EXCLUDED_REGIONS.has(j.regionId)) continue;
    counts.set(j.regionId, (counts.get(j.regionId) ?? 0) + 1);
  }
  return QUEBEC_REGIONS.filter((r) => counts.has(r.id))
    .map((r) => ({ id: r.id, label: labelForRegion(r.id) ?? r.label, count: counts.get(r.id)! }))
    .sort((a, b) => b.count - a.count);
}

/** Métiers CCQ ayant au moins une offre (pour les pages/index SEO), triés par volume. */
export function tradesWithCounts(): FacetLink[] {
  const counts = new Map<string, number>();
  for (const j of allJobs()) {
    const trade = ccqTradeOf(j.title);
    if (trade) counts.set(trade.id, (counts.get(trade.id) ?? 0) + 1);
  }
  return CCQ_TRADES.filter((t) => counts.has(t.id))
    .map((t) => ({ id: t.id, label: t.label, count: counts.get(t.id)! }))
    .sort((a, b) => b.count - a.count);
}

/** Offres d'un employeur (par id de source), les plus récentes d'abord. */
export function jobsByEmployer(sourceId: string): Job[] {
  return allJobs()
    .filter((j) => j.sourceId === sourceId)
    .sort((a, b) => (b.postedAt ?? b.scrapedAt).localeCompare(a.postedAt ?? a.scrapedAt));
}

/** Ids d'employeurs ayant au moins une offre (une page profil chacun). */
export function employerIdsWithJobs(): string[] {
  return [...new Set(allJobs().map((j) => j.sourceId))];
}

export interface EmployerProfile {
  readonly id: string;
  readonly name: string;
  readonly employer?: DiscoveredEmployer;
  readonly jobs: Job[];
}

/** Fiche complète d'un employeur pour sa page profil. */
export function employerProfile(id: string): EmployerProfile | undefined {
  const jobs = jobsByEmployer(id);
  const employer = getEmployer(id);
  if (jobs.length === 0 && !employer) return undefined;
  const name = employer?.name ?? jobs[0]?.company ?? id;
  return { id, name, employer, jobs };
}

/**
 * Offres similaires : même région ou même domaine, employeur/annonce distincts.
 * Sert la section « Offres similaires » des pages de détail.
 */
export function similarJobs(job: Job, limit = 6): Job[] {
  const scored = allJobs()
    .filter((j) => j.id !== job.id)
    .map((j) => {
      let score = 0;
      if (job.regionId && j.regionId === job.regionId) score += 2;
      if (job.categoryId && j.categoryId === job.categoryId) score += 2;
      if (j.sourceId === job.sourceId) score += 1;
      return { j, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.j);
}

/** Classement des employeurs qui recrutent dans une région. */
export function companiesByRegion(regionId: string): HiringCompany[] {
  return rankHiringCompanies(allJobs(), { regionId });
}

/** Classement des employeurs qui recrutent pour un métier CCQ. */
export function companiesByTrade(tradeId: string): HiringCompany[] {
  return rankHiringCompanies(allJobs(), { tradeId });
}

// --- Dashboard « marché » (#82) + baromètre de tension (#84) --------------

let historyCache: HiringHistory | null = null;

/** Historique de recrutement lu sur disque au build (`public/data/hiring-history.json`). */
function loadHiringHistory(): HiringHistory {
  if (!historyCache) {
    const path = join(process.cwd(), "public", "data", "hiring-history.json");
    try {
      historyCache = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as HiringHistory) : {};
    } catch {
      historyCache = {};
    }
  }
  return historyCache;
}

/** Série « marché » : total des offres trouvées par jour, tous employeurs confondus. */
export function marketHistory(max = 30): HiringPoint[] {
  return aggregateMarketHistory(loadHiringHistory(), max);
}

export interface MarketOverview {
  readonly jobs: number;
  readonly employers: number;
  readonly regions: number;
  readonly trades: number;
}

/** Chiffres clés du marché (instantané courant). */
export function marketOverview(): MarketOverview {
  return {
    jobs: allJobs().length,
    employers: employerIdsWithJobs().length,
    regions: regionsWithCounts().length,
    trades: tradesWithCounts().length,
  };
}

export interface TradeTension extends FacetLink {
  /** Effectif CCQ (main-d'œuvre active), si renseigné. */
  readonly workforce: number | null;
  /** Offres pour 1000 travailleurs, si l'effectif est connu. */
  readonly tension: number | null;
}

/**
 * Baromètre de tension par métier : nombre d'offres (demande) et, si l'effectif
 * CCQ est renseigné dans `CCQ_WORKFORCE`, le ratio offres/1000 travailleurs.
 * Trié par tension décroissante quand elle existe, sinon par volume d'offres.
 */
export function tradeTension(): TradeTension[] {
  const rows = tradesWithCounts().map((t) => {
    const workforce = workforceFor(t.id);
    return { ...t, workforce, tension: tensionPer1000(t.count, workforce) };
  });
  return rows.sort((a, b) => {
    if (a.tension != null && b.tension != null) return b.tension - a.tension;
    if (a.tension != null) return -1;
    if (b.tension != null) return 1;
    return b.count - a.count;
  });
}

/** Guide salarial métier × région (idée 83). */
export function salaryGuide(): SalaryGuideRow[] {
  return buildSalaryGuide(allJobs());
}

export function salaryGuideTrade(tradeId: string): SalaryGuideRow | undefined {
  return salaryGuideByTrade(salaryGuide(), tradeId);
}

/** Rapport des 7 derniers jours (idée 86), calculé à chaque build. */
export function weeklyReport(): WeeklyReport {
  return buildWeeklyReport(allJobs());
}
