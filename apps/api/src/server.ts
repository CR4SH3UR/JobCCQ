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
  getScraperMetrics,
  getStats,
  searchJobs,
} from "./repository.js";
import { jobsToRss } from "@jobccq/shared";
import { listScraperIds } from "./scrapers/registry.js";
import { runScraper } from "./orchestrator.js";
import { registerAdminRoutes, adminGuard } from "./admin.js";

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
    salaryListed: raw.salaryListed === "1" || raw.salaryListed === true,
    postedWithinDays: raw.postedWithinDays,
    postedSince: raw.postedSince,
    ccqOnly: raw.ccqOnly === "1" || raw.ccqOnly === true,
    trades: asArray(raw.trades),
    shifts: asArray(raw.shifts)?.filter((s) => s === "jour" || s === "soir" || s === "nuit"),
    near: raw.near,
    radiusKm: raw.radiusKm,
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

  // Flux RSS de la même recherche (jusqu'à 50 offres).
  app.get("/api/jobs.rss", async (req, reply) => {
    try {
      const query = parseJobQuery({ ...(req.query as Record<string, unknown>), pageSize: "50", page: "1" });
      const result = await searchJobs(query);
      const site = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://jobccqc.ca").replace(
        /\/$/,
        "",
      );
      const qs = new URLSearchParams(req.query as Record<string, string>).toString();
      const xml = jobsToRss(result.items, {
        siteUrl: site,
        feedUrl: `${site}/api/jobs.rss${qs ? `?${qs}` : ""}`,
        title: query.q ? `JobCCQc — ${query.q}` : undefined,
      });
      return reply.type("application/rss+xml; charset=utf-8").send(xml);
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

  // Métriques historisées des scrapers (#113) : taux de succès, durée, volume.
  app.get<{ Querystring: { limit?: string } }>("/api/scraper-metrics", async (req) =>
    getScraperMetrics(Math.min(2000, Math.max(1, Number(req.query.limit) || 300))),
  );

  // Déclenche un scraping (nécessite un accès réseau aux sources).
  app.post<{ Body: { sourceId?: string; query?: string; location?: string; maxPages?: number } }>(
    "/api/scrape",
    { preHandler: adminGuard },
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
