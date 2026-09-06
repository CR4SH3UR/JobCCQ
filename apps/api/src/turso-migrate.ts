/**
 * Migration unique vers **Turso** (libSQL).
 *
 *   TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… npm run turso:migrate -w @jobccq/api
 *
 * 1. crée le schéma sur Turso (DDL généré par Prisma) ;
 * 2. importe les employeurs depuis packages/shared/src/discovered.json ;
 * 3. importe les offres depuis apps/web/public/data/jobs.json.
 *
 * Idempotent : ré-exécutable (CREATE TABLE IF NOT EXISTS + upserts).
 */
import "./env.js";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { prisma } from "./db.js";
import { jobToRow } from "./repository.js";
import type { Job } from "@jobccq/shared";

/** Insère un tableau par lots (createMany) pour limiter les allers-retours réseau. */
async function insertChunked<T>(
  rows: T[],
  create: (batch: T[]) => Promise<unknown>,
  size = 200,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await create(rows.slice(i, i + size));
  }
}

const exec = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const API_ROOT = resolve(HERE, "..");
const DISCOVERED = resolve(HERE, "../../../packages/shared/src/discovered.json");
const SNAPSHOT = resolve(HERE, "../../web/public/data/jobs.json");

type Employer = {
  id: string;
  name: string;
  homepage: string;
  careersUrl: string;
  method: string;
  careersUrl2?: string;
  method2?: string;
  region?: string;
  rbq?: string;
  scope?: string;
  sectors?: string[];
  verified?: boolean;
  enabled?: boolean;
};

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    console.error("❌ TURSO_DATABASE_URL manquant (voir infra/README-turso.md).");
    process.exit(1);
  }

  // 1) Schéma : DDL généré par Prisma, exécuté sur la base cible via libSQL.
  //    `IF NOT EXISTS` rend l'opération ré-exécutable sans casser l'existant.
  const { stdout: ddl } = await exec(
    "npx",
    ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"],
    { cwd: API_ROOT, maxBuffer: 10 * 1024 * 1024 },
  );
  const safeDdl = ddl.replace(/CREATE TABLE\s+"/gi, 'CREATE TABLE IF NOT EXISTS "').replace(
    /CREATE (UNIQUE )?INDEX\s+"/gi,
    (m, u) => `CREATE ${u ?? ""}INDEX IF NOT EXISTS "`,
  );
  const libsql = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  await libsql.executeMultiple(safeDdl);
  await libsql.execute("ALTER TABLE Employer ADD COLUMN notes TEXT").catch(() => {});
  await libsql.execute("ALTER TABLE Employer ADD COLUMN careersUrl2 TEXT").catch(() => {});
  await libsql.execute("ALTER TABLE Employer ADD COLUMN method2 TEXT").catch(() => {});
  await libsql.execute("ALTER TABLE ScrapeRun ADD COLUMN diffJson TEXT").catch(() => {});
  await libsql.execute("ALTER TABLE Job ADD COLUMN linkStatus TEXT").catch(() => {});
  await libsql.execute("ALTER TABLE Job ADD COLUMN historyJson TEXT").catch(() => {});
  await libsql.execute("ALTER TABLE ScrapeRun ADD COLUMN rollbackJson TEXT").catch(() => {});
  console.log("✅ Schéma appliqué sur la base cible.");

  // Table vierge (idempotent) : on repart d'un état propre avant l'insertion en
  // lot. Insertion par createMany chunké — ~35 allers-retours au lieu de ~7000.
  await prisma.job.deleteMany({});
  await prisma.employer.deleteMany({});

  // 2) Employeurs (discovered.json → table Employer).
  const employers = JSON.parse(await readFile(DISCOVERED, "utf8")) as Employer[];
  const empRows = employers.map((e) => ({
    id: e.id,
    name: e.name,
    homepage: e.homepage,
    careersUrl: e.careersUrl,
    method: e.method,
    careersUrl2: e.careersUrl2 ?? null,
    method2: e.method2 ?? null,
    region: e.region ?? null,
    rbq: e.rbq ?? null,
    scope: e.scope ?? null,
    sectors: JSON.stringify(e.sectors ?? []),
    verified: !!e.verified,
    enabled: e.enabled !== false,
  }));
  await insertChunked(empRows, (batch) => prisma.employer.createMany({ data: batch }));
  console.log(`✅ Employeurs importés : ${empRows.length}`);

  // 3) Offres (jobs.json → table Job).
  const jobs = JSON.parse(await readFile(SNAPSHOT, "utf8")) as Job[];
  const jobRows = jobs.map(jobToRow);
  await insertChunked(jobRows, (batch) => prisma.job.createMany({ data: batch }));
  console.log(`✅ Offres importées : ${jobRows.length}`);
  console.log("🎉 Migration Turso terminée.");
}

main()
  .catch((err) => {
    console.error("Erreur de migration :", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
