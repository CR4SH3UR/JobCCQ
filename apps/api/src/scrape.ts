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
  // SCRAPE_IDS="id1,id2,…" cible une liste précise (utile pour la découverte).
  const envIds = process.env.SCRAPE_IDS?.split(",").map((s) => s.trim()).filter(Boolean);
  const ids = envIds?.length ? envIds : maybeSource ? [maybeSource] : listScraperIds();
  const params = {
    query: query || undefined,
    location: location || undefined,
    maxPages: Number(process.env.SCRAPE_MAX_PAGES ?? 3),
  };

  // SCRAPE_FORCE="id1,id2" (ou "1"/"all"/"true" = toutes les sources ciblées) :
  // outrepasse le garde-fou anti-purge pour ces sources. Sert au remplacement
  // PROPRE d'un employeur mal configuré (ex. Balvent : 36 fausses offres d'une
  // page de recherche Jobillico → 2 vrais postes de la bonne URL). À n'utiliser
  // que sciemment, sur une source dont on VEUT écraser l'ancien contenu.
  const forceRaw = process.env.SCRAPE_FORCE?.trim() ?? "";
  const forceAll = ["1", "all", "true", "*"].includes(forceRaw.toLowerCase());
  const forceIds = forceAll
    ? new Set(ids)
    : new Set(forceRaw.split(",").map((s) => s.trim()).filter(Boolean));

  console.log(`▶ Scraping des sources : ${ids.join(", ")}`);
  console.log(`   Paramètres : ${JSON.stringify(params)}`);
  if (forceIds.size) console.log(`   ⚠️  Remplacement forcé (anti-purge ignoré) : ${[...forceIds].join(", ")}`);
  console.log();

  // « sync » : retire les postes comblés, mais ne détruit jamais sur un scrape
  // vide/échoué (ex. Jobillico renvoie 403 depuis les IP de CI). Combiné à
  // l'import de l'instantané en amont (workflow), un site bloqué garde ses
  // offres au lieu d'être vidé.
  const reports = await runScrapers(ids, params, "sync", forceIds);

  console.log("\n=== Résumé ===");
  for (const r of reports) {
    const icon = r.status === "success" ? "✅" : "❌";
    console.log(
      `${icon} ${r.sourceId} — ${r.found} trouvées, ${r.inserted} ajoutées, ${r.updated} MAJ` +
        (r.error ? ` (${r.error})` : ""),
    );
  }

  // Diff des offres : ce qui a été ajouté / modifié / retiré pendant ce run.
  const DIFF_MAX = 10;
  const withDiff = reports.filter(
    (r) => r.diff && (r.diff.added.length || r.diff.changed.length || r.diff.removed.length),
  );
  if (withDiff.length) {
    console.log("\n=== Diff des offres ===");
    for (const r of withDiff) {
      const d = r.diff!;
      console.log(`\n${r.sourceId} (+${d.added.length} ~${d.changed.length} -${d.removed.length})`);
      const show = (sign: string, entries: { title: string; url: string }[]) => {
        for (const e of entries.slice(0, DIFF_MAX)) console.log(`  ${sign} ${e.title}`);
        if (entries.length > DIFF_MAX)
          console.log(`  ${sign} … et ${entries.length - DIFF_MAX} autres`);
      };
      show("+", d.added);
      show("~", d.changed);
      show("-", d.removed);
    }
  }
}

main()
  .catch((err) => {
    console.error("Erreur de scraping :", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
