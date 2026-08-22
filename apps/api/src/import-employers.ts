/**
 * Import **incrémental** d'employeurs dans Turso (upsert ciblé).
 *
 *   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run import:employers -w @jobccq/api
 *
 * Lit `apps/api/data/jobillico-employers.json` (`{ upsert: Employer[], fixUrl:
 * {id, careersUrl}[] }`) et :
 *  - **crée** les employeurs dont l'`id` n'existe pas encore ;
 *  - pour un `id` déjà présent, ne met à jour QUE `careersUrl` (jamais name /
 *    homepage / rbq / region / sectors — pas d'écrasure des données existantes) ;
 *  - applique les correctifs `fixUrl` (normalisation du lien Jobillico).
 *
 * Ne touche JAMAIS la table `Job`. Idempotent : ré-exécutable sans effet de bord.
 * Contrairement à `turso-migrate.ts` (qui vide puis recharge), ce script est
 * strictement additif/correctif — sûr en production.
 */
import "./env.js";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./db.js";

interface EmpIn {
  id: string;
  name: string;
  homepage: string;
  careersUrl: string;
  method: string;
  region?: string;
  rbq?: string;
  scope?: string;
  sectors?: string[];
}
interface Changeset {
  upsert: EmpIn[];
  fixUrl: { id: string; careersUrl: string }[];
}

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, "../data/jobillico-employers.json");

async function main() {
  if (!process.env.TURSO_DATABASE_URL) {
    console.log("TURSO_DATABASE_URL manquant — import ignoré (rien à faire hors Turso).");
    return;
  }
  const { upsert, fixUrl } = JSON.parse(await readFile(FILE, "utf-8")) as Changeset;

  // Un seul aller-retour pour connaître l'existant (id → careersUrl).
  const existing = new Map(
    (await prisma.employer.findMany({ select: { id: true, careersUrl: true } })).map((r) => [r.id, r.careersUrl]),
  );

  let created = 0;
  let urlUpdated = 0;
  let unchanged = 0;

  for (const e of upsert) {
    const cur = existing.get(e.id);
    if (cur !== undefined) {
      // id déjà présent → on ne corrige que le lien, sans écraser le reste.
      if (cur !== e.careersUrl) {
        await prisma.employer.update({ where: { id: e.id }, data: { careersUrl: e.careersUrl } });
        urlUpdated++;
      } else {
        unchanged++;
      }
      continue;
    }
    await prisma.employer.create({
      data: {
        id: e.id,
        name: e.name,
        homepage: e.homepage,
        careersUrl: e.careersUrl,
        method: e.method,
        region: e.region ?? null,
        rbq: e.rbq ?? null,
        scope: e.scope ?? null,
        sectors: JSON.stringify(e.sectors ?? []),
      },
    });
    existing.set(e.id, e.careersUrl);
    created++;
  }

  let fixed = 0;
  let fixSkipped = 0;
  for (const f of fixUrl) {
    if (!existing.has(f.id)) {
      fixSkipped++;
      continue;
    }
    if (existing.get(f.id) === f.careersUrl) {
      unchanged++;
      continue;
    }
    await prisma.employer.update({ where: { id: f.id }, data: { careersUrl: f.careersUrl } });
    fixed++;
  }

  console.log(
    `Employeurs — créés: ${created}, careersUrl mis à jour: ${urlUpdated}, ` +
      `correctifs fixUrl: ${fixed}, inchangés: ${unchanged}, fixUrl introuvables: ${fixSkipped}`,
  );
  const total = await prisma.employer.count();
  console.log(`Total employeurs en base : ${total}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Erreur import-employers :", err);
  process.exitCode = 1;
});
