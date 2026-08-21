/**
 * Importe l'instantané statique (apps/web/public/data/jobs.json) dans la base.
 * Utile en CI : la base est vierge à chaque exécution ; on la repeuple avec les
 * offres déjà en ligne avant de re-scraper UN seul site, pour ne pas perdre les
 * autres au moment de ré-exporter.
 *
 *   npm run import:snapshot
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Job } from "@jobccq/shared";
import { upsertJobs } from "./repository.js";
import { prisma } from "./db.js";

const SNAP = resolve(process.cwd(), "../web/public/data/jobs.json");

async function main() {
  let jobs: Job[] = [];
  try {
    jobs = JSON.parse(await readFile(SNAP, "utf8")) as Job[];
  } catch (err) {
    console.warn(`⚠ Instantané illisible (${(err as Error).message}) — base laissée vide.`);
    return;
  }
  const { inserted, updated } = await upsertJobs(jobs);
  console.log(`✅ Instantané importé : ${jobs.length} offres (${inserted} ajoutées, ${updated} MAJ).`);
}

main()
  .catch((err) => {
    console.error("Erreur d'import :", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
