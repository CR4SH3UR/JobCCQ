/**
 * Insert dans Turso les employeurs présents dans `discovered.json` (git) mais
 * absents de la table `Employer`. N'écrase JAMAIS une fiche déjà en base
 * (l'admin reste la source de vérité pour les URLs / méthodes éditées).
 * Ignore (et retire à nouveau) les ids ancrés dans `EmployerTombstone`
 * (supprimés ou fusionnés dans l'admin).
 *
 * Sans ça, un nouvel employeur committé (ex. CCQ) n'apparaît pas dans la
 * console (lecture Turso) et le scrape CI régénère `discovered.json` depuis la
 * base → « Scraper introuvable ».
 *
 *   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run sync:employers -w @jobccq/api
 */
import "./env.js";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { prisma } from "./db.js";
import { applyEmployerTombstones, listRetiredEmployerIds } from "./employer-tombstones.js";
import { employersToInsert, toEmployerRow, type SyncableEmployer } from "./sync-employers-pure.js";

export { employersToInsert, toEmployerRow, type SyncableEmployer } from "./sync-employers-pure.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DISCOVERED = resolve(HERE, "../../../packages/shared/src/discovered.json");

async function main() {
  if (!process.env.TURSO_DATABASE_URL) {
    console.log("TURSO_DATABASE_URL manquant — sync ignoré (rien à faire hors Turso).");
    return;
  }
  const fromGit = JSON.parse(await readFile(DISCOVERED, "utf8")) as SyncableEmployer[];
  const healed = await applyEmployerTombstones();
  if (healed) {
    console.log(`↩ ${healed} employeur(s) ancré(s) (supprimé/fusionné) retirés à nouveau de la base.`);
  }
  const retiredIds = await listRetiredEmployerIds();
  const existingIds = new Set(
    (await prisma.employer.findMany({ select: { id: true } })).map((r) => r.id),
  );
  const missing = employersToInsert(fromGit, existingIds, retiredIds);
  if (!missing.length) {
    console.log(`Aucun employeur git manquant (${existingIds.size} déjà en base).`);
    return;
  }
  // `missing` est déjà dédupliqué par id (cf. employersToInsert) et exclut les
  // ids présents en base : pas de `skipDuplicates` (non supporté sur SQLite/libSQL).
  await prisma.employer.createMany({
    data: missing.map(toEmployerRow),
  });
  console.log(
    `✅ ${missing.length} employeur(s) ajouté(s) depuis git : ${missing.map((e) => e.id).join(", ")}`,
  );
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  main()
    .catch((err) => {
      console.error("Erreur sync-employers :", err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
