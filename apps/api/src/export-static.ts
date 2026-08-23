/**
 * Exporte un instantané statique des offres vers le site web
 * (apps/web/public/data/jobs.json), consommé par le build GitHub Pages.
 *
 *   npm run export:static            # depuis les données de démo (sans BD)
 *   npm run export:static -- --from-db   # depuis la base réelle (après scraping)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { effectiveRegionId, type Job } from "@jobccq/shared";
import { SEED_JOBS } from "./seed-data.js";
import { seedToJob } from "./seed-transform.js";

// Instantané **client** (chargé dans le navigateur pour la recherche/les
// filtres) : descriptions tronquées à un extrait, pour garder la charge légère.
const OUT = resolve(process.cwd(), "../web/public/data/jobs.json");
// Instantané **complet** (descriptions entières) : lu au build pour pré-générer
// les pages de détail (SEO + lecture) ; non publié (hors `public/`).
const OUT_FULL = resolve(process.cwd(), "../web/data/jobs.full.json");
// Longueur de l'extrait de description embarqué dans l'instantané client :
// suffisant pour l'aperçu des cartes et la pertinence de la recherche plein
// texte, sans embarquer des milliers de fiches complètes.
const CLIENT_DESC_MAX = 240;

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

  // Région manquante (localisation non fournie par le site) : on retombe sur la
  // région administrative (RBQ) de l'employeur. Approximation raisonnable pour
  // les entrepreneurs locaux, et cela alimente le filtre « Région » du site.
  let filled = 0;
  for (const job of jobs) {
    if (job.regionId) continue;
    const region = effectiveRegionId(job);
    if (region) {
      job.regionId = region;
      filled++;
    }
  }
  const withRegion = jobs.filter((j) => j.regionId).length;
  const withDesc = jobs.filter((j) => j.description).length;

  // Instantané complet (descriptions entières) → pages de détail au build.
  await mkdir(dirname(OUT_FULL), { recursive: true });
  await writeFile(OUT_FULL, JSON.stringify(jobs));

  // Instantané client : on tronque les descriptions à un court extrait.
  const clientJobs = jobs.map((j) => {
    if (!j.description || j.description.length <= CLIENT_DESC_MAX) return j;
    return { ...j, description: `${j.description.slice(0, CLIENT_DESC_MAX - 1)}…` };
  });
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(clientJobs));

  console.log(`✅ ${jobs.length} offres exportées.`);
  console.log(`   • Client (extraits) → ${OUT}`);
  console.log(`   • Complet (fiches)  → ${OUT_FULL}`);
  console.log(
    `📍 Régions : ${withRegion}/${jobs.length} renseignées (${filled} complétées via la région RBQ de l'employeur).`,
  );
  console.log(`📝 Descriptions : ${withDesc}/${jobs.length} renseignées.`);
}

main().catch((err) => {
  console.error("Erreur d'export :", err);
  process.exitCode = 1;
});
