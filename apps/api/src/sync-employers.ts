/**
 * Insert dans Turso les employeurs présents dans `discovered.json` (git) mais
 * absents de la table `Employer`. N'écrase JAMAIS une fiche déjà en base
 * (l'admin reste la source de vérité pour les URLs / méthodes éditées).
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

const HERE = dirname(fileURLToPath(import.meta.url));
const DISCOVERED = resolve(HERE, "../../../packages/shared/src/discovered.json");

export interface SyncableEmployer {
  id: string;
  name: string;
  homepage: string;
  careersUrl: string;
  method: string;
  region?: string;
  rbq?: string;
  scope?: string;
  sectors?: string[];
  verified?: boolean;
  enabled?: boolean;
}

/** Fiches git à créer en base : absentes, et non désactivées. */
export function employersToInsert(
  fromGit: readonly SyncableEmployer[],
  existingIds: ReadonlySet<string>,
): SyncableEmployer[] {
  return fromGit.filter((e) => !existingIds.has(e.id) && e.enabled !== false);
}

export function toEmployerRow(e: SyncableEmployer) {
  return {
    id: e.id,
    name: e.name,
    homepage: e.homepage,
    careersUrl: e.careersUrl,
    method: e.method,
    region: e.region ?? null,
    rbq: e.rbq ?? null,
    scope: e.scope ?? null,
    sectors: JSON.stringify(e.sectors ?? []),
    verified: !!e.verified,
    enabled: e.enabled !== false,
  };
}

async function main() {
  if (!process.env.TURSO_DATABASE_URL) {
    console.log("TURSO_DATABASE_URL manquant — sync ignoré (rien à faire hors Turso).");
    return;
  }
  const fromGit = JSON.parse(await readFile(DISCOVERED, "utf8")) as SyncableEmployer[];
  const existingIds = new Set(
    (await prisma.employer.findMany({ select: { id: true } })).map((r) => r.id),
  );
  const missing = employersToInsert(fromGit, existingIds);
  if (!missing.length) {
    console.log(`Aucun employeur git manquant (${existingIds.size} déjà en base).`);
    return;
  }
  await prisma.employer.createMany({
    data: missing.map(toEmployerRow),
    skipDuplicates: true,
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
