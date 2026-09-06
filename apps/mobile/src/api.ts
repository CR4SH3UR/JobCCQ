/**
 * Client de l'API JobCCQ (back-end Fastify).
 *
 * Reproduit la sérialisation de apps/web/src/lib/data.ts : les paramètres
 * tableaux (regions, categories, ...) sont joints en CSV, cf. `toParams`.
 */
import type {
  HiringCompany,
  JobQuery,
  JobSearchResult,
  SourceWithMeta,
  Stats,
} from "./shared";

/** Base URL de l'API — voir .env.example / README pour la config LAN. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

/** Sérialise une JobQuery en query-string, comme apps/web/src/lib/data.ts#toParams. */
function toParams(q: Partial<JobQuery>): URLSearchParams {
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
  if (q.sort) p.set("sort", q.sort);
  if (q.page != null) p.set("page", String(q.page));
  if (q.pageSize != null) p.set("pageSize", String(q.pageSize));
  return p;
}

/**
 * Erreur réseau/API typée, avec un message déjà adapté à l'affichage :
 * distingue une API injoignable (back-end arrêté, mauvaise IP…) d'une
 * réponse HTTP en erreur.
 */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiGet<T>(path: string, params?: URLSearchParams): Promise<T> {
  const qs = params && [...params.keys()].length ? `?${params.toString()}` : "";
  const url = `${API_URL}${path}${qs}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new ApiError(
      `Impossible de joindre l'API à ${API_URL}. Démarre le back-end (npm run dev:api) ` +
        `ou vérifie EXPO_PUBLIC_API_URL — sur un téléphone physique, "localhost" ne fonctionne pas.`,
    );
  }

  if (!res.ok) {
    throw new ApiError(`L'API a répondu avec une erreur (HTTP ${res.status}) sur ${path}.`);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(`Réponse inattendue de l'API sur ${path} (JSON invalide).`);
  }
}

/** GET /api/jobs — recherche d'offres avec filtres, tri et pagination. */
export async function searchJobs(query: JobQuery): Promise<JobSearchResult> {
  return apiGet<JobSearchResult>("/api/jobs", toParams(query));
}

/** GET /api/companies — vue « Qui recrute » (entreprises agrégées). */
export async function searchCompanies(
  query: Partial<JobQuery>,
): Promise<{ companies: HiringCompany[]; total: number }> {
  return apiGet<{ companies: HiringCompany[]; total: number }>("/api/companies", toParams(query));
}

/** GET /api/sources — répertoire des sources surveillées. */
export async function getSources(): Promise<{ sources: SourceWithMeta[] }> {
  return apiGet<{ sources: SourceWithMeta[] }>("/api/sources");
}

/** GET /api/jobs/:id — détail d'une offre. */
export async function getJobById(id: string): Promise<{ job: import("./shared").Job }> {
  return apiGet<{ job: import("./shared").Job }>(`/api/jobs/${encodeURIComponent(id)}`);
}
