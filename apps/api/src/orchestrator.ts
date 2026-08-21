import { RawJobSchema, type Job } from "@jobccq/shared";
import { prisma } from "./db.js";
import { normalizeRawJob } from "./normalize.js";
import { upsertJobs } from "./repository.js";
import { createHttpContext } from "./scrapers/http.js";
import { getScraper, listScraperIds } from "./scrapers/registry.js";
import type { Scraper, ScrapeParams } from "./scrapers/types.js";

export interface RunReport {
  sourceId: string;
  found: number;
  inserted: number;
  updated: number;
  status: "success" | "error";
  error?: string;
}

/**
 * Exécute un **scraper donné** (instance) : collecte → validation →
 * normalisation → upsert + journal. Retourne le rapport et les offres
 * normalisées (utile pour un aperçu). Permet à la console d'admin de scraper
 * avec une configuration fraîche (URL éditée) sans passer par le registre.
 */
export async function runScraperInstance(
  scraper: Scraper,
  params: ScrapeParams = {},
): Promise<{ report: RunReport; jobs: Job[] }> {
  const sourceId = scraper.id;
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
    return { report: { sourceId, found: raw.length, inserted, updated, status: "success" }, jobs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: { status: "error", error: message, finishedAt: new Date() },
    });
    log(`erreur : ${message}`);
    return {
      report: { sourceId, found: 0, inserted: 0, updated: 0, status: "error", error: message },
      jobs: [],
    };
  }
}

/** Exécute un scraper du registre par son id. */
export async function runScraper(sourceId: string, params: ScrapeParams = {}): Promise<RunReport> {
  const scraper = getScraper(sourceId);
  if (!scraper) {
    return { sourceId, found: 0, inserted: 0, updated: 0, status: "error", error: "Scraper introuvable" };
  }
  return (await runScraperInstance(scraper, params)).report;
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
