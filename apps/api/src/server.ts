import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import {
  EMPLOYMENT_TYPES,
  JOB_CATEGORIES,
  JOB_SOURCES,
  LANGUAGES,
  QUEBEC_REGIONS,
  REMOTE_TYPES,
  SORT_OPTIONS,
  JobQuerySchema,
  type JobQuery,
} from "@jobccq/shared";
import {
  getHiringCompanies,
  getJobById,
  getStats,
  searchJobs,
} from "./repository.js";
import { listScraperIds } from "./scrapers/registry.js";
import { runScraper } from "./orchestrator.js";
import { registerAdminRoutes } from "./admin.js";

/** Normalise un paramètre de requête en tableau (répété ou séparé par des virgules). */
function asArray(v: unknown): string[] | undefined {
  if (v == null) return undefined;
  const arr = Array.isArray(v) ? v : String(v).split(",");
  const cleaned = arr.map((s) => String(s).trim()).filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}

function parseJobQuery(raw: Record<string, unknown>): JobQuery {
  return JobQuerySchema.parse({
    q: raw.q,
    company: raw.company,
    regions: asArray(raw.regions),
    cities: asArray(raw.cities),
    categories: asArray(raw.categories),
    employmentTypes: asArray(raw.employmentTypes),
    remote: asArray(raw.remote),
    sources: asArray(raw.sources),
    languages: asArray(raw.languages),
    salaryMin: raw.salaryMin,
    postedWithinDays: raw.postedWithinDays,
    sort: raw.sort,
    page: raw.page,
    pageSize: raw.pageSize,
  });
}

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: true });
  app.register(cors, { origin: true });

  app.get("/health", async () => ({ ok: true, service: "jobccq-api" }));

  // Console d'administration (liste / édition / re-scrape d'un employeur).
  registerAdminRoutes(app);

  // Métadonnées / taxonomies pour construire l'UI (filtres).
  app.get("/api/meta", async () => ({
    regions: QUEBEC_REGIONS,
    categories: JOB_CATEGORIES,
    employmentTypes: EMPLOYMENT_TYPES,
    remoteTypes: REMOTE_TYPES,
    languages: LANGUAGES,
    sortOptions: SORT_OPTIONS,
  }));

  // Répertoire des sources (avec disponibilité du scraper et volume en base).
  app.get("/api/sources", async () => {
    const withScraper = new Set(listScraperIds());
    const stats = await getStats();
    const counts = new Map(stats.bySource.map((s) => [s.id, s.count]));
    return {
      sources: JOB_SOURCES.map((s) => ({
        ...s,
        hasScraper: withScraper.has(s.id),
        jobCount: counts.get(s.id) ?? 0,
      })),
    };
  });

  // Recherche d'offres avec filtres, tri et pagination.
  app.get("/api/jobs", async (req, reply) => {
    try {
      const query = parseJobQuery(req.query as Record<string, unknown>);
      return await searchJobs(query);
    } catch (err) {
      reply.code(400);
      return { error: "Requête invalide", details: (err as Error).message };
    }
  });

  // Détail d'une offre.
  app.get<{ Params: { id: string } }>("/api/jobs/:id", async (req, reply) => {
    const job = await getJobById(req.params.id);
    if (!job) {
      reply.code(404);
      return { error: "Offre introuvable" };
    }
    return job;
  });

  // Vue « Qui recrute » : entreprises agrégées (mêmes filtres que /api/jobs).
  app.get("/api/companies", async (req, reply) => {
    try {
      const query = parseJobQuery(req.query as Record<string, unknown>);
      const companies = await getHiringCompanies(query);
      return { companies, total: companies.length };
    } catch (err) {
      reply.code(400);
      return { error: "Requête invalide", details: (err as Error).message };
    }
  });

  // Statistiques globales.
  app.get("/api/stats", async () => getStats());

  // Déclenche un scraping (nécessite un accès réseau aux sources).
  app.post<{ Body: { sourceId?: string; query?: string; location?: string; maxPages?: number } }>(
    "/api/scrape",
    async (req, reply) => {
      const { sourceId, query, location, maxPages } = req.body ?? {};
      if (!sourceId) {
        reply.code(400);
        return { error: "sourceId requis", available: listScraperIds() };
      }
      const report = await runScraper(sourceId, { query, location, maxPages });
      return report;
    },
  );

  return app;
}
