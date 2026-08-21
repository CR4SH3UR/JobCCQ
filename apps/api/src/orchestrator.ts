import { RawJobSchema, type Job } from "@jobccq/shared";
import { prisma } from "./db.js";
import { normalizeRawJob } from "./normalize.js";
import { syncSourceJobs, upsertJobs } from "./repository.js";
import { createHttpContext } from "./scrapers/http.js";
import { getScraper, listScraperIds } from "./scrapers/registry.js";
import type { Scraper, ScrapeParams } from "./scrapers/types.js";

/**
 * Mode d'écriture :
 * - `upsert` (défaut) : insère/actualise sans jamais retirer (aperçu admin).
 * - `sync` : retire aussi les offres disparues (postes comblés), mais jamais
 *   sur un scrape vide/échoué (voir syncSourceJobs) — utilisé par le CLI de
 *   scraping (workflow planifié / re-scrape d'un site).
 */
export type PersistMode = "upsert" | "sync";

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
  persist: PersistMode = "upsert",
): Promise<{ report: RunReport; jobs: Job[] }> {
  const sourceId = scraper.id;
  const run = await prisma.scrapeRun.create({ data: { sourceId } });
  const log = (m: string) => console.log(`[scrape:${sourceId}] ${m}`);

  try {
    // La source peut signaler qu'elle n'a **aucun poste ouvert** (page récupérée
    // mais « aucune offre en ce moment ») → purge légitime, contrairement à un 0
    // par échec/blocage qui, lui, conserve l'état existant.
    let noOpenings = false;
    const raw = await scraper.scrape(
      params,
      createHttpContext(log, () => {
        noOpenings = true;
      }),
    );

    const jobs: Job[] = [];
    for (const candidate of raw) {
      const parsed = RawJobSchema.safeParse(candidate);
      if (parsed.success) jobs.push(normalizeRawJob(parsed.data));
      else log(`offre ignorée (invalide) : ${parsed.error.issues[0]?.message ?? "?"}`);
    }

    const { inserted, updated } =
      persist === "sync"
        ? await syncSourceJobs(sourceId, jobs, noOpenings && jobs.length === 0)
        : await upsertJobs(jobs);
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
export async function runScraper(
  sourceId: string,
  params: ScrapeParams = {},
  persist: PersistMode = "upsert",
): Promise<RunReport> {
  const scraper = getScraper(sourceId);
  if (!scraper) {
    return { sourceId, found: 0, inserted: 0, updated: 0, status: "error", error: "Scraper introuvable" };
  }
  return (await runScraperInstance(scraper, params, persist)).report;
}

/** Exécute plusieurs scrapers en séquence (poli envers les sources). */
export async function runScrapers(
  ids: string[] = listScraperIds(),
  params: ScrapeParams = {},
  persist: PersistMode = "upsert",
): Promise<RunReport[]> {
  const reports: RunReport[] = [];
  for (const id of ids) {
    reports.push(await runScraper(id, params, persist));
  }
  return reports;
}
