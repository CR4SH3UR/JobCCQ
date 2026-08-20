/**
 * Exporte un instantané statique des offres vers le site web
 * (apps/web/public/data/jobs.json), consommé par le build GitHub Pages.
 *
 *   npm run export:static            # depuis les données de démo (sans BD)
 *   npm run export:static -- --from-db   # depuis la base réelle (après scraping)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Job } from "@jobccq/shared";
import { SEED_JOBS } from "./seed-data.js";
import { seedToJob } from "./seed-transform.js";

const OUT = resolve(process.cwd(), "../web/public/data/jobs.json");

async function main() {
  const fromDb = process.argv.includes("--from-db");
  let jobs: Job[];

  if (fromDb) {
    const { getAllJobs } = await import("./repository.js");
    const { prisma } = await import("./db.js");
    jobs = await getAllJobs();
    await prisma.$disconnect();
    if (jobs.length === 0) {
      console.warn("⚠ Base vide — repli sur les données de démo.");
      jobs = SEED_JOBS.map(seedToJob);
    }
  } else {
    jobs = SEED_JOBS.map(seedToJob);
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(jobs));
  console.log(`✅ ${jobs.length} offres exportées vers ${OUT}`);
}

main().catch((err) => {
  console.error("Erreur d'export :", err);
  process.exitCode = 1;
});
