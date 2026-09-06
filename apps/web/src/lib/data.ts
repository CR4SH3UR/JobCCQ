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
  municipalityIndex,
  municipalityByCity,
  attachDuplicateAlts,
  type HiringCompany,
  type Job,
  type JobQuery,
  type JobSearchResult,
  type JobSource,
} from "@jobccq/shared";
import { fetchWithOfflineFallback, setOfflineMeta } from "./offline-snapshot";
import { matchSnapshotJson, putSnapshotResponse } from "./snapshot-cache";
import { loadJobsIncremental } from "./jobs-snapshot";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const STATIC = process.env.NEXT_PUBLIC_STATIC_DATA === "1";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * `fetch()` vers l'API d'administration en joignant le jeton Supabase de la
 * session courante (`Authorization: Bearer …`). Les routes /admin/* du serveur
 * exigent ce jeton (admin authentifié) : sans lui, la requête est refusée (401).
 */
export async function adminFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { supabase } = await import("./supabase");
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  try {
    const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* Pas de session : la requête partira sans jeton et sera refusée côté serveur. */
  }
  return fetch(url, { ...init, headers });
}

/** Sources disposant d'un scraper (miroir de apps/api/src/scrapers/registry.ts). */
const SCRAPER_IDS = new Set([
  "ccq-construction",
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
    // Hors ligne : on sert la dernière copie Cache Storage (idée 74).
    const url = `${BASE_PATH}/data/jobs.json`;
    snapshotCache = (async () => {
      // Idée 120 : manifeste + shards — ne retélécharge que les régions changées.
      try {
        const incremental = await loadJobsIncremental(BASE_PATH);
        if (incremental) {
          setOfflineMeta({ fromCache: false });
          return incremental;
        }
      } catch {
        /* manifeste / shards absents → jobs.json */
      }
      const loaded = await fetchWithOfflineFallback<Job[]>({
        live: async () => {
          const r = await fetch(url, { cache: "no-cache" });
          if (!r.ok) throw new Error(`Instantané introuvable (HTTP ${r.status})`);
          void putSnapshotResponse(url, r.clone());
          return r.json() as Promise<Job[]>;
        },
        readCache: () => matchSnapshotJson<Job[]>(url),
        writeCache: async () => {
          /* le clone HTTP est déjà posé dans `live` */
        },
      });
      setOfflineMeta({ fromCache: loaded.fromCache, savedAt: loaded.savedAt });
      return loaded.data;
    })()
      // On masque les offres des sources désactivées manuellement.
      .then((jobs) =>
        DISABLED_SOURCE_IDS.size ? jobs.filter((j) => !DISABLED_SOURCE_IDS.has(j.sourceId)) : jobs,
      )
      // Reclassement **municipalité → région** en direct depuis Supabase : une
      // offre dont la ville figure dans la table éditable (console admin) est
      // reclassée dans la bonne région ici, au chargement — donc un changement
      // s'applique sans redéploiement. Filtres, facettes et stats en héritent
      // (tout passe par cet instantané). Dégrade proprement si indisponible.
      .then(reclassifyByMunicipality)
      .catch((err) => {
        snapshotCache = null;
        throw err;
      });
  }
  return snapshotCache;
}

// --- Overlay des éditions admin (Supabase, lu en direct) -------------------
//
// Les corrections d'offres faites dans /admin sont enregistrées dans la table
// `job_overrides` (Supabase, lecture publique) et superposées sur l'instantané
// **côté navigateur** → visibles sans redéploiement, exactement comme le
// reclassement municipalité → région. Cache court (TTL) pour que le polling
// « live » (useLivePoll, 30 s) récupère une édition récente sans marteler
// Supabase à chaque requête.

type OverridesMap = Map<string, Record<string, unknown>>;

let overridesCache: { at: number; map: Promise<OverridesMap> } | null = null;
const OVERRIDES_TTL_MS = 20_000;

function loadOverrides(): Promise<OverridesMap> {
  const now = Date.now();
  if (!overridesCache || now - overridesCache.at > OVERRIDES_TTL_MS) {
    overridesCache = {
      at: now,
      map: import("./job-overrides")
        .then((m) => m.fetchJobOverrides())
        .catch(() => new Map() as OverridesMap),
    };
  }
  return overridesCache.map;
}

/**
 * Vide le cache de l'overlay pour que la prochaine lecture reparte de Supabase.
 * Appelé par la console d'admin juste après une édition → effet immédiat (le
 * `useLivePoll` relit alors des patchs frais au lieu du cache court).
 */
export function invalidateJobOverrides(): void {
  overridesCache = null;
}

/**
 * Vide tous les caches de données (instantané + overlay des éditions). La
 * prochaine lecture repart du réseau : instantané `jobs.json`, patchs Supabase
 * et table des municipalités (ville/région) frais. Utilisé par le bouton
 * « Rafraîchir » de la liste d'offres.
 */
export function invalidateJobsCache(): void {
  snapshotCache = null;
  overridesCache = null;
  vocabCache = null;
}

/**
 * Instantané + overlay des éditions admin appliqué. Ne mute pas l'instantané
 * partagé : seules les offres patchées sont copiées.
 */
async function loadJobs(opts?: { includeOffConstruction?: boolean }): Promise<Job[]> {
  const [jobs, overrides, posted] = await Promise.all([
    loadSnapshot(),
    loadOverrides(),
    import("./employer-jobs").then((m) => m.fetchApprovedEmployerJobs()).catch(() => [] as Job[]),
  ]);
  let merged = jobs;
  if (overrides.size) {
    const { overlayJobs, publicJobs } = await import("./job-overrides");
    merged = opts?.includeOffConstruction ? overlayJobs(jobs, overrides) : publicJobs(jobs, overrides);
  }
  if (!posted.length) return merged;
  const seen = new Set(merged.map((j) => j.id));
  return [...merged, ...posted.filter((j) => !seen.has(j.id))];
}

/**
 * Villes candidates d'une offre, dans l'ordre de priorité : la `city` déclarée,
 * puis chaque segment de `location`. On découpe sur les virgules/parenthèses et
 * les tirets **entourés d'espaces** (« Ville - QC ») — jamais sur un tiret
 * interne, pour ne pas casser un nom comme « Trois-Rivières ».
 */
function cityCandidates(job: Job): string[] {
  const out: string[] = [];
  if (job.city?.trim()) out.push(job.city);
  if (job.location) {
    for (const seg of job.location.split(/[,(){}]|\s[-–—]\s/)) {
      const s = seg.trim();
      if (s) out.push(s);
    }
  }
  return out;
}

/**
 * Remplit **ville + région** des offres en direct via la table des municipalités
 * (Supabase). Pour chaque offre, on cherche la première ville reconnue parmi
 * `city` puis les segments de `location` : la `city` est renseignée (nom
 * canonique) si elle manque, et la région est (re)classée en conséquence. Un
 * changement de la table s'applique **sans redéploiement**. Ne mute que les
 * offres concernées ; en cas d'erreur / table absente, l'instantané est inchangé.
 */
async function reclassifyByMunicipality(jobs: Job[]): Promise<Job[]> {
  try {
    const { fetchMunicipalities } = await import("./municipalities");
    const index = municipalityIndex(await fetchMunicipalities());
    if (!index.size) return jobs;
    for (const job of jobs) {
      for (const candidate of cityCandidates(job)) {
        const m = municipalityByCity(index, candidate);
        if (!m) continue;
        if (!job.city?.trim()) job.city = m.name; // remplit la ville manquante
        if (m.regionId && m.regionId !== job.regionId) job.regionId = m.regionId;
        break; // première ville reconnue = la bonne
      }
    }
  } catch {
    /* Supabase indisponible : on garde ville/région de l'instantané. */
  }
  return jobs;
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
  if (q.salaryListed) p.set("salaryListed", "1");
  if (q.postedWithinDays != null) p.set("postedWithinDays", String(q.postedWithinDays));
  if (q.postedSince) p.set("postedSince", q.postedSince);
  if (q.ccqOnly) p.set("ccqOnly", "1");
  if (q.trades?.length) p.set("trades", q.trades.join(","));
  if (q.shifts?.length) p.set("shifts", q.shifts.join(","));
  if (q.near) p.set("near", q.near);
  if (q.radiusKm != null) p.set("radiusKm", String(q.radiusKm));
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
    const jobs = await loadJobs();
    return applyQuery(jobs, query);
  }
  return apiGet<JobSearchResult>("/api/jobs", toParams(query));
}

/** Même recherche, y compris les offres « hors construction » (console admin). */
export async function searchAdminJobs(query: JobQuery): Promise<JobSearchResult> {
  if (STATIC) {
    const jobs = await loadJobs({ includeOffConstruction: true });
    return applyQuery(jobs, query);
  }
  return apiGet<JobSearchResult>("/api/jobs", toParams(query));
}

export async function getJobById(id: string): Promise<Job | null> {
  if (STATIC) {
    const jobs = await loadJobs();
    const job = jobs.find((j) => j.id === id);
    return job ? attachDuplicateAlts(job, jobs) : null;
  }
  try {
    return await apiGet<Job>(`/api/jobs/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

export async function getSimilarJobs(job: Job, limit = 6): Promise<Job[]> {
  const candidates = await searchJobs(
    buildQuery({
      regions: job.regionId ? [job.regionId] : undefined,
      categories: job.categoryId ? [job.categoryId] : undefined,
      pageSize: 100,
    }),
  );
  const scored = candidates.items
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

export async function getJobsBySource(sourceId: string): Promise<Job[]> {
  if (STATIC) {
    const jobs = await loadJobs();
    return jobs
      .filter((j) => j.sourceId === sourceId)
      .sort((a, b) => (b.postedAt ?? b.scrapedAt).localeCompare(a.postedAt ?? a.scrapedAt));
  }
  const result = await searchJobs(
    buildQuery({ sources: [sourceId], sort: "recent", pageSize: 1_000 }),
  );
  return result.items;
}

export async function searchCompanies(
  query: JobQuery,
): Promise<{ companies: HiringCompany[]; total: number }> {
  if (STATIC) {
    const jobs = await loadJobs();
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
    const jobs = await loadJobs();
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
    const jobs = await loadJobs();
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

// --- Vocabulaire d'autocomplétion (entreprises + villes) -------------------
//
// Alimente la barre de recherche : liste dédoublonnée des entreprises et des
// villes présentes dans les offres. En mode statique, calculée depuis
// l'instantané ; via l'API, depuis un large échantillon d'offres. Mise en
// cache (une seule construction) et invalidée par `invalidateJobsCache`.

export interface SearchVocabulary {
  companies: string[];
  cities: string[];
}

let vocabCache: Promise<SearchVocabulary> | null = null;

async function buildVocabulary(): Promise<SearchVocabulary> {
  const jobs = STATIC
    ? await loadJobs()
    : (await searchJobs(buildQuery({ pageSize: 5_000 }))).items;

  const companies = new Map<string, string>(); // clé normalisée → libellé affiché
  const cities = new Map<string, string>();
  for (const j of jobs) {
    const c = j.company?.trim();
    if (c) companies.set(c.toLowerCase(), c);
    const city = j.city?.trim() || cityCandidates(j)[0]?.trim();
    if (city) cities.set(city.toLowerCase(), city);
  }
  const byLabel = (a: string, b: string) => a.localeCompare(b, "fr");
  return {
    companies: [...companies.values()].sort(byLabel),
    cities: [...cities.values()].sort(byLabel),
  };
}

export function getSearchVocabulary(): Promise<SearchVocabulary> {
  if (!vocabCache) {
    vocabCache = buildVocabulary().catch((err) => {
      vocabCache = null;
      throw err;
    });
  }
  return vocabCache;
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
