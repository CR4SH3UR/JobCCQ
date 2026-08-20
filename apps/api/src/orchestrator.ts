import { RawJobSchema, type Job } from "@jobccq/shared";
import { prisma } from "./db.js";
import { normalizeRawJob } from "./normalize.js";
import { upsertJobs } from "./repository.js";
import { createHttpContext } from "./scrapers/http.js";
import { getScraper, listScraperIds } from "./scrapers/registry.js";
import type { ScrapeParams } from "./scrapers/types.js";

export interface RunReport {
  sourceId: string;
  found: number;
  inserted: number;
  updated: number;
  status: "success" | "error";
  error?: string;
}

/** Exécute un scraper : collecte → validation → normalisation → upsert + journal. */
export async function runScraper(sourceId: string, params: ScrapeParams = {}): Promise<RunReport> {
  const scraper = getScraper(sourceId);
  if (!scraper) {
    return { sourceId, found: 0, inserted: 0, updated: 0, status: "error", error: "Scraper introuvable" };
  }

  const run = await prisma.scrapeRun.create({ data: { sourceId } });
  const log = (m: string) => console.log(`[scrape:${sourceId}] ${m}`);

  try {
    const raw = await scraper.scrape(params, createHttpContext(log));

    const jobs: Job[] = [];
    for (const candidate of raw) {
      const parsed = RawJobSchema.safeParse(candidate);
      if (parsed.success) jobs.push(normalizeRawJob(parsed.data));
      else log(`offre ignorée (invalide) : ${parsed.error.issues[0]?.message ?? "?"}`);
    }

    const { inserted, updated } = await upsertJobs(jobs);
    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: { status: "success", found: raw.length, inserted, updated, finishedAt: new Date() },
    });
    log(`terminé : ${raw.length} trouvées, ${inserted} ajoutées, ${updated} mises à jour`);
    return { sourceId, found: raw.length, inserted, updated, status: "success" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: { status: "error", error: message, finishedAt: new Date() },
    });
    log(`erreur : ${message}`);
    return { sourceId, found: 0, inserted: 0, updated: 0, status: "error", error: message };
  }
}

/** Exécute plusieurs scrapers en séquence (poli envers les sources). */
export async function runScrapers(
  ids: string[] = listScraperIds(),
  params: ScrapeParams = {},
): Promise<RunReport[]> {
  const reports: RunReport[] = [];
  for (const id of ids) {
    reports.push(await runScraper(id, params));
  }
  return reports;
}
