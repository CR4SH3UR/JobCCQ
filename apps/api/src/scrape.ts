/**
 * CLI de scraping.
 *
 *   npm run scrape                       # toutes les sources branchées
 *   npm run scrape -- pomerleau          # une source précise
 *
 * ⚠️  Nécessite un accès réseau aux sites d'emploi (bloqué dans certains
 *     environnements restreints — voir le README). Utilise `npm run seed`
 *     pour peupler la base hors-ligne.
 */
import { listScraperIds } from "./scrapers/registry.js";
import { runScrapers } from "./orchestrator.js";
import { prisma } from "./db.js";

async function main() {
  const [, , maybeSource, query, location] = process.argv;
  const ids = maybeSource ? [maybeSource] : listScraperIds();
  const params = {
    query: query || undefined,
    location: location || undefined,
    maxPages: Number(process.env.SCRAPE_MAX_PAGES ?? 3),
  };

  console.log(`▶ Scraping des sources : ${ids.join(", ")}`);
  console.log(`   Paramètres : ${JSON.stringify(params)}\n`);

  const reports = await runScrapers(ids, params);

  console.log("\n=== Résumé ===");
  for (const r of reports) {
    const icon = r.status === "success" ? "✅" : "❌";
    console.log(
      `${icon} ${r.sourceId} — ${r.found} trouvées, ${r.inserted} ajoutées, ${r.updated} MAJ` +
        (r.error ? ` (${r.error})` : ""),
    );
  }
}

main()
  .catch((err) => {
    console.error("Erreur de scraping :", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
