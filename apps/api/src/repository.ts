import type { Job as PrismaJob } from "@prisma/client";
import {
  applyQuery,
  toHiringCompanies,
  type HiringCompany,
  type Job,
  type JobQuery,
  type JobSearchResult,
} from "@jobccq/shared";
import { prisma } from "./db.js";

/** Nombre max d'offres chargées en mémoire pour le filtrage (MVP). */
const MAX_JOBS = 20_000;

function parseJsonArray(value: string): string[] {
  try {
    const v = JSON.parse(value);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Convertit une ligne Prisma en offre du contrat partagé. */
export function rowToJob(row: PrismaJob): Job {
  return {
    id: row.id,
    sourceId: row.sourceId,
    url: row.url,
    title: row.title,
    company: row.company,
    companyLogoUrl: row.companyLogoUrl ?? undefined,
    location: row.location ?? undefined,
    regionId: row.regionId ?? undefined,
    city: row.city ?? undefined,
    remote: (row.remote as Job["remote"]) ?? undefined,
    categoryId: row.categoryId ?? undefined,
    employmentType: (row.employmentType as Job["employmentType"]) ?? undefined,
    salaryMin: row.salaryMin ?? undefined,
    salaryMax: row.salaryMax ?? undefined,
    salaryPeriod: (row.salaryPeriod as Job["salaryPeriod"]) ?? undefined,
    currency: row.currency ?? "CAD",
    description: row.description ?? undefined,
    tags: parseJsonArray(row.tags),
    languages: parseJsonArray(row.languages) as Job["languages"],
    postedAt: row.postedAt?.toISOString(),
    scrapedAt: row.scrapedAt.toISOString(),
  };
}

/** Prépare les champs d'écriture d'une offre (dates + JSON sérialisés). */
export function jobToRow(job: Job) {
  return {
    id: job.id,
    sourceId: job.sourceId,
    url: job.url,
    title: job.title,
    company: job.company,
    companyLogoUrl: job.companyLogoUrl ?? null,
    location: job.location ?? null,
    regionId: job.regionId ?? null,
    city: job.city ?? null,
    remote: job.remote ?? null,
    categoryId: job.categoryId ?? null,
    employmentType: job.employmentType ?? null,
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    salaryPeriod: job.salaryPeriod ?? null,
    currency: job.currency ?? "CAD",
    description: job.description ?? null,
    tags: JSON.stringify(job.tags ?? []),
    languages: JSON.stringify(job.languages ?? []),
    postedAt: job.postedAt ? new Date(job.postedAt) : null,
    scrapedAt: job.scrapedAt ? new Date(job.scrapedAt) : new Date(),
  };
}

export async function getAllJobs(): Promise<Job[]> {
  const rows = await prisma.job.findMany({ take: MAX_JOBS, orderBy: { postedAt: "desc" } });
  return rows.map(rowToJob);
}

/** Recherche + filtres + tri + pagination (logique partagée, en mémoire). */
export async function searchJobs(query: JobQuery): Promise<JobSearchResult> {
  const jobs = await getAllJobs();
  return applyQuery(jobs, query);
}

export async function getJobById(id: string): Promise<Job | null> {
  const row = await prisma.job.findUnique({ where: { id } });
  return row ? rowToJob(row) : null;
}

/** Vue « Qui recrute » : entreprises agrégées, filtrables par la même requête. */
export async function getHiringCompanies(
  query: Partial<JobQuery> = {},
): Promise<HiringCompany[]> {
  const jobs = await getAllJobs();
  const q = { sort: "recent", page: 1, pageSize: MAX_JOBS, ...query } as JobQuery;
  const filtered = applyQuery(jobs, { ...q, page: 1, pageSize: MAX_JOBS });
  return toHiringCompanies(filtered.items);
}

export interface UpsertResult {
  inserted: number;
  updated: number;
}

/** Insère ou met à jour un lot d'offres (dédupliquées par id). */
export async function upsertJobs(jobs: Job[]): Promise<UpsertResult> {
  if (jobs.length === 0) return { inserted: 0, updated: 0 };

  // Déduplication + upsert par **URL** (clé unique en base). Une même offre peut
  // être publiée par deux sources (ex. un employeur curé et son doublon
  // découvert partagent la même page Jobillico) : elles produisent la même URL
  // sous des id différents. Cibler l'URL évite la violation `unique(url)` qui
  // faisait planter tout le scrape ; la 1re source qui l'a insérée en garde
  // l'attribution.
  const byUrl = new Map(jobs.map((j) => [j.url, j]));
  const unique = [...byUrl.values()];

  const existing = new Set(
    (
      await prisma.job.findMany({
        where: { url: { in: unique.map((j) => j.url) } },
        select: { url: true },
      })
    ).map((r) => r.url),
  );

  let inserted = 0;
  let updated = 0;
  for (const job of unique) {
    const data = jobToRow(job);
    await prisma.job.upsert({
      where: { url: job.url },
      create: data,
      // On ne réécrit pas scrapedAt/createdAt à chaque passage inutilement,
      // mais on rafraîchit le contenu susceptible d'avoir changé.
      update: {
        title: data.title,
        company: data.company,
        companyLogoUrl: data.companyLogoUrl,
        location: data.location,
        regionId: data.regionId,
        city: data.city,
        remote: data.remote,
        categoryId: data.categoryId,
        employmentType: data.employmentType,
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
        salaryPeriod: data.salaryPeriod,
        description: data.description,
        tags: data.tags,
        languages: data.languages,
        postedAt: data.postedAt,
      },
    });
    if (existing.has(job.url)) updated += 1;
    else inserted += 1;
  }
  return { inserted, updated };
}

/**
 * Synchronise les offres d'une source **sans jamais détruire sur échec**.
 *
 * - Un scrape qui ne renvoie rien (erreur HTTP 403 anti-robot, page vide) ne
 *   supprime AUCUNE offre existante : on conserve le dernier bon état.
 * - Une chute brutale du nombre d'offres (lecture partielle probable, pagination
 *   coupée) ne purge pas non plus : on ajoute/actualise sans retirer.
 * - Sinon, on retire les offres disparues (postes comblés) en plus d'insérer/
 *   actualiser les offres courantes.
 */
/** Au-delà de ce nombre d'offres, une source « joignable mais vide » (sans
 *  déclaration explicite) n'est PAS purgée : un 0 vient probablement d'un
 *  parseur cassé plutôt que d'un vrai vide. Les petites sources, elles, sont
 *  purgées (typiquement une page carrières sans offre ouverte). */
const REACHABLE_EMPTY_PURGE_MAX = 10;

export async function syncSourceJobs(
  sourceId: string,
  jobs: Job[],
  opts: { reachableEmpty?: boolean; explicitEmpty?: boolean; force?: boolean } = {},
): Promise<UpsertResult & { removed: number }> {
  if (jobs.length === 0) {
    const { reachableEmpty = false, explicitEmpty = false } = opts;
    // 0 offre : la page a été récupérée (site joignable) et n'a aucune offre.
    // Un 0 par échec/blocage réseau (403, page vide) n'a AUCUN de ces drapeaux →
    // on conserve le dernier bon état. `force` n'intervient PAS ici : il ne sert
    // qu'à outrepasser le garde-fou d'une VRAIE lecture plus petite (jobs > 0),
    // jamais à vider sur un scrape à 0 (sinon un 403 transitoire effacerait tout).
    // - `explicitEmpty` (« aucune offre en ce moment ») : purge toute taille.
    // - `reachableEmpty` (page réelle, 0 offre) : purge des petites sources.
    if (explicitEmpty) {
      const del = await prisma.job.deleteMany({ where: { sourceId } });
      return { inserted: 0, updated: 0, removed: del.count };
    }
    if (reachableEmpty) {
      const existingCount = await prisma.job.count({ where: { sourceId } });
      if (existingCount <= REACHABLE_EMPTY_PURGE_MAX) {
        const del = await prisma.job.deleteMany({ where: { sourceId } });
        return { inserted: 0, updated: 0, removed: del.count };
      }
    }
    return { inserted: 0, updated: 0, removed: 0 };
  }

  const existingCount = await prisma.job.count({ where: { sourceId } });
  const res = await upsertJobs(jobs);

  // Garde-fou anti-purge : si le nouveau lot est bien plus petit que l'existant
  // (source volumineuse), c'est probablement une lecture partielle ou un blocage
  // — on n'efface pas les offres « manquantes ». `force` outrepasse ce garde-fou
  // (remplacement propre demandé, ex. employeur mal configuré : Balvent 36 → 2).
  const suspicious = !opts.force && existingCount >= 10 && jobs.length < existingCount * 0.4;
  let removed = 0;
  if (!suspicious) {
    const keep = jobs.map((j) => j.id);
    const del = await prisma.job.deleteMany({
      where: { sourceId, id: { notIn: keep } },
    });
    removed = del.count;
  }
  return { ...res, removed };
}

/** Statistiques globales pour la page d'accueil / le tableau de bord. */
export async function getStats() {
  const [total, bySource, byRegion, byCategory, distinctCompanies, lastRuns] = await Promise.all([
    prisma.job.count(),
    prisma.job.groupBy({ by: ["sourceId"], _count: true }),
    prisma.job.groupBy({ by: ["regionId"], _count: true }),
    prisma.job.groupBy({ by: ["categoryId"], _count: true }),
    prisma.job.findMany({ distinct: ["company"], select: { company: true } }),
    prisma.scrapeRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
  ]);

  return {
    totalJobs: total,
    totalCompanies: distinctCompanies.length,
    bySource: bySource.map((s) => ({ id: s.sourceId, count: s._count })),
    byRegion: byRegion.map((r) => ({ id: r.regionId ?? "autre", count: r._count })),
    byCategory: byCategory.map((c) => ({ id: c.categoryId ?? "autre", count: c._count })),
    recentRuns: lastRuns,
  };
}
