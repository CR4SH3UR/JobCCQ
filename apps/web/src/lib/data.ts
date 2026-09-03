/**
 * Couche de données unifiée.
 *
 * Deux modes, même interface :
 *  - API (dev/production) : requêtes vers le back-end Fastify.
 *  - Statique (GitHub Pages) : charge un instantané `jobs.json` et exécute
 *    toute la logique de filtrage/tri dans le navigateur via @jobccq/shared.
 *
 * Bascule via NEXT_PUBLIC_STATIC_DATA=1 (posé par le build GitHub Pages).
 */
import {
  applyQuery,
  toHiringCompanies,
  ALL_SOURCES,
  DISCOVERED_EMPLOYERS,
  DISABLED_SOURCE_IDS,
  type HiringCompany,
  type Job,
  type JobQuery,
  type JobSearchResult,
  type JobSource,
} from "@jobccq/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const STATIC = process.env.NEXT_PUBLIC_STATIC_DATA === "1";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Sources disposant d'un scraper (miroir de apps/api/src/scrapers/registry.ts). */
const SCRAPER_IDS = new Set([
  "atwill-morin",
  "hamel-construction",
  "pomerleau",
  "lafontaine",
  "beluga",
  "jmdemers",
  "ebc",
  "leqel",
  "portneuf",
  "cote-et-fils",
  "jcdrolet",
  "lefrancois",
  "refrabec",
  ...DISCOVERED_EMPLOYERS.map((d) => d.id),
]);

export type SourceWithMeta = JobSource & { hasScraper: boolean; jobCount: number };

export interface Stats {
  totalJobs: number;
  totalCompanies: number;
  bySource: { id: string; count: number }[];
  byRegion: { id: string; count: number }[];
  byCategory: { id: string; count: number }[];
  recentRuns: unknown[];
}

// --- Chargement de l'instantané (mode statique) ----------------------------

let snapshotCache: Promise<Job[]> | null = null;
function loadSnapshot(): Promise<Job[]> {
  if (!snapshotCache) {
    // `no-cache` = on revalide l'instantané auprès du serveur (ETag) à chaque
    // chargement. Sans ça, `force-cache` fige la première version vue par le
    // navigateur : après une mise à jour des offres, un visiteur de retour
    // continuait de voir l'ancien jeu de données (ex. les 72 offres de démo).
    // La réponse reste servie depuis le cache tant que l'ETag n'a pas changé
    // (304), donc l'impact réseau est minime.
    snapshotCache = fetch(`${BASE_PATH}/data/jobs.json`, { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`Instantané introuvable (HTTP ${r.status})`);
        return r.json() as Promise<Job[]>;
      })
      // On masque les offres des sources désactivées manuellement.
      .then((jobs) =>
        DISABLED_SOURCE_IDS.size ? jobs.filter((j) => !DISABLED_SOURCE_IDS.has(j.sourceId)) : jobs,
      )
      .catch((err) => {
        snapshotCache = null;
        throw err;
      });
  }
  return snapshotCache;
}

// --- Sérialisation d'une requête vers l'API --------------------------------

function toParams(q: JobQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  if (q.company) p.set("company", q.company);
  if (q.cities?.length) p.set("cities", q.cities.join(","));
  if (q.regions?.length) p.set("regions", q.regions.join(","));
  if (q.categories?.length) p.set("categories", q.categories.join(","));
  if (q.employmentTypes?.length) p.set("employmentTypes", q.employmentTypes.join(","));
  if (q.remote?.length) p.set("remote", q.remote.join(","));
  if (q.sources?.length) p.set("sources", q.sources.join(","));
  if (q.languages?.length) p.set("languages", q.languages.join(","));
  if (q.salaryMin != null) p.set("salaryMin", String(q.salaryMin));
  if (q.postedWithinDays != null) p.set("postedWithinDays", String(q.postedWithinDays));
  if (q.ccqOnly) p.set("ccqOnly", "1");
  p.set("sort", q.sort);
  p.set("page", String(q.page));
  p.set("pageSize", String(q.pageSize));
  return p;
}

async function apiGet<T>(path: string, params?: URLSearchParams): Promise<T> {
  const qs = params && [...params.keys()].length ? `?${params.toString()}` : "";
  const res = await fetch(`${API_URL}${path}${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${path} — HTTP ${res.status}`);
  return (await res.json()) as T;
}

// --- API publique de la couche de données ----------------------------------

export async function searchJobs(query: JobQuery): Promise<JobSearchResult> {
  if (STATIC) {
    const jobs = await loadSnapshot();
    return applyQuery(jobs, query);
  }
  return apiGet<JobSearchResult>("/api/jobs", toParams(query));
}

export async function searchCompanies(
  query: JobQuery,
): Promise<{ companies: HiringCompany[]; total: number }> {
  if (STATIC) {
    const jobs = await loadSnapshot();
    const filtered = applyQuery(jobs, { ...query, page: 1, pageSize: 100_000 });
    const companies = toHiringCompanies(filtered.items);
    return { companies, total: companies.length };
  }
  const r = await apiGet<{ companies: HiringCompany[]; total: number }>(
    "/api/companies",
    toParams(query),
  );
  return r;
}

export async function getSources(): Promise<{ sources: SourceWithMeta[] }> {
  if (STATIC) {
    const jobs = await loadSnapshot();
    const counts = new Map<string, number>();
    for (const j of jobs) counts.set(j.sourceId, (counts.get(j.sourceId) ?? 0) + 1);
    return {
      sources: ALL_SOURCES.filter((s) => s.enabled !== false).map((s) => ({
        ...s,
        hasScraper: SCRAPER_IDS.has(s.id),
        jobCount: counts.get(s.id) ?? 0,
      })),
    };
  }
  return apiGet<{ sources: SourceWithMeta[] }>("/api/sources");
}

export async function getStats(): Promise<Stats> {
  if (STATIC) {
    const jobs = await loadSnapshot();
    const group = (pick: (j: Job) => string | undefined) => {
      const m = new Map<string, number>();
      for (const j of jobs) {
        const id = pick(j) ?? "autre";
        m.set(id, (m.get(id) ?? 0) + 1);
      }
      return [...m.entries()].map(([id, count]) => ({ id, count }));
    };
    return {
      totalJobs: jobs.length,
      totalCompanies: new Set(jobs.map((j) => j.company)).size,
      bySource: group((j) => j.sourceId),
      byRegion: group((j) => j.regionId),
      byCategory: group((j) => j.categoryId),
      recentRuns: [],
    };
  }
  return apiGet<Stats>("/api/stats");
}

/** Construit une requête complète à partir de filtres partiels. */
export function buildQuery(partial: Partial<JobQuery>): JobQuery {
  return {
    sort: "recent",
    page: 1,
    pageSize: 20,
    ...partial,
  } as JobQuery;
}
