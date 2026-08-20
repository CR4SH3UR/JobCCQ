/**
 * Peuple la base avec un jeu d'offres réalistes (démo hors-ligne).
 *
 *   npm run seed
 *
 * Utile quand le scraping live n'est pas disponible (réseau restreint) :
 * tout le produit (API, site, app) reste pleinement fonctionnel.
 */
import { prisma } from "./db.js";
import { upsertJobs } from "./repository.js";
import { SEED_JOBS } from "./seed-data.js";
import { seedToJob } from "./seed-transform.js";

async function main() {
  console.log(`▶ Peuplement : ${SEED_JOBS.length} offres de démonstration…`);
  const jobs = SEED_JOBS.map(seedToJob);
  const { inserted, updated } = await upsertJobs(jobs);
  const total = await prisma.job.count();
  console.log(`✅ ${inserted} ajoutées, ${updated} mises à jour. Total en base : ${total}.`);
}

main()
  .catch((err) => {
    console.error("Erreur de seed :", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
