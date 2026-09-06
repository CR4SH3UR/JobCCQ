import { RawJobSchema, type Job } from "@jobccq/shared";
import { prisma } from "./db.js";
import { normalizeRawJob, isJunkTitle } from "./normalize.js";
import { annotateLinkStatus } from "./link-check.js";
import { syncSourceJobs, upsertJobs, type JobDiffEntry } from "./repository.js";
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
  /** Diff des offres : ajoutées / modifiées / retirées (titres + URLs). */
  diff?: { added: JobDiffEntry[]; changed: JobDiffEntry[]; removed: JobDiffEntry[] };
}

/** Nombre max de lignes de diff loguées par catégorie (lisibilité console). */
const DIFF_LOG_MAX = 10;
/** Plafond de lignes persistées par catégorie (colonne ScrapeRun.diffJson). */
const DIFF_STORE_MAX = 50;

function compactDiff(diff: {
  added: JobDiffEntry[];
  changed: JobDiffEntry[];
  removed: JobDiffEntry[];
}) {
  const cap = (entries: JobDiffEntry[]) => entries.slice(0, DIFF_STORE_MAX);
  return {
    added: cap(diff.added),
    changed: cap(diff.changed),
    removed: cap(diff.removed),
  };
}

function logDiff(
  log: (m: string) => void,
  diff: { added: JobDiffEntry[]; changed: JobDiffEntry[]; removed: JobDiffEntry[] },
): void {
  const show = (sign: string, entries: JobDiffEntry[]) => {
    for (const e of entries.slice(0, DIFF_LOG_MAX)) log(`${sign} ${e.title} — ${e.url}`);
    if (entries.length > DIFF_LOG_MAX) log(`${sign} … et ${entries.length - DIFF_LOG_MAX} autres`);
  };
  show("+", diff.added);
  show("~", diff.changed);
  show("-", diff.removed);
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
  force = false,
): Promise<{ report: RunReport; jobs: Job[] }> {
  const sourceId = scraper.id;
  const run = await prisma.scrapeRun.create({ data: { sourceId } });
  const log = (m: string) => console.log(`[scrape:${sourceId}] ${m}`);

  try {
    // La source peut signaler qu'elle a été **récupérée mais sans aucune offre**
    // (site joignable, 0 poste) → purge légitime, contrairement à un 0 par
    // échec/blocage réseau qui conserve l'état existant. `explicitEmpty` = la
    // page le déclare (purge toute taille) ; sinon `reachableEmpty` (purge des
    // petites sources seulement, cf. syncSourceJobs).
    let reachableEmpty = false;
    let explicitEmpty = false;
    const raw = await scraper.scrape(
      params,
      createHttpContext(log, (explicit) => {
        reachableEmpty = true;
        explicitEmpty = explicit;
      }),
    );

    const jobs: Job[] = [];
    for (const candidate of raw) {
      const parsed = RawJobSchema.safeParse(candidate);
      if (!parsed.success) {
        log(`offre ignorée (invalide) : ${parsed.error.issues[0]?.message ?? "?"}`);
        continue;
      }
      const job = normalizeRawJob(parsed.data);
      // Écarte les intitulés parasites (reste de CSS/SVG, boutons, compteurs,
      // « Appliquez | Indeed »…) pour ne pas polluer le catalogue.
      if (isJunkTitle(job.title)) {
        log(`offre ignorée (titre parasite) : ${job.title.slice(0, 60)}`);
        continue;
      }
      jobs.push(job);
    }

    await annotateLinkStatus(jobs, log);

    const result =
      persist === "sync"
        ? await syncSourceJobs(sourceId, jobs, {
            reachableEmpty: reachableEmpty && jobs.length === 0,
            explicitEmpty: explicitEmpty && jobs.length === 0,
            force,
          })
        : await upsertJobs(jobs);
    const { inserted, updated } = result;
    const removed = "removed" in result ? result.removed : 0;
    const removedJobs: JobDiffEntry[] =
      "removedJobs" in result ? (result.removedJobs as JobDiffEntry[]) : [];
    const rollbackJobs = "rollbackJobs" in result ? result.rollbackJobs : [];
    const diff = { added: result.added, changed: result.changed, removed: removedJobs };
    const runUpdate = {
      status: "success" as const,
      found: raw.length,
      inserted,
      updated,
      finishedAt: new Date(),
    };
    try {
      await prisma.scrapeRun.update({
        where: { id: run.id },
        data: {
          ...runUpdate,
          diffJson: JSON.stringify(compactDiff(diff)),
          rollbackJson: rollbackJobs.length ? JSON.stringify(rollbackJobs) : null,
        },
      });
    } catch {
      try {
        await prisma.scrapeRun.update({
          where: { id: run.id },
          data: { ...runUpdate, diffJson: JSON.stringify(compactDiff(diff)) },
        });
      } catch {
        await prisma.scrapeRun.update({ where: { id: run.id }, data: runUpdate });
      }
    }
    log(`terminé : ${raw.length} trouvées, ${inserted} ajoutées, ${updated} mises à jour, ${removed} retirées`);
    logDiff(log, diff);
    return {
      report: { sourceId, found: raw.length, inserted, updated, status: "success", diff },
      jobs,
    };
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
  force = false,
): Promise<RunReport> {
  const scraper = getScraper(sourceId);
  if (!scraper) {
    return { sourceId, found: 0, inserted: 0, updated: 0, status: "error", error: "Scraper introuvable" };
  }
  return (await runScraperInstance(scraper, params, persist, force)).report;
}

/**
 * Exécute plusieurs scrapers en séquence (poli envers les sources). `forceIds`
 * = sources pour lesquelles on outrepasse le garde-fou anti-purge (remplacement
 * propre d'un employeur mal configuré, ex. Balvent 36 → 2).
 */
export async function runScrapers(
  ids: string[] = listScraperIds(),
  params: ScrapeParams = {},
  persist: PersistMode = "upsert",
  forceIds: Set<string> = new Set(),
): Promise<RunReport[]> {
  const reports: RunReport[] = [];
  for (const id of ids) {
    reports.push(await runScraper(id, params, persist, forceIds.has(id)));
  }
  return reports;
}
