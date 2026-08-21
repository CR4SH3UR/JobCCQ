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
import { upsertJobs } from "./repository.js";
import type { Job } from "@jobccq/shared";

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
  console.log("✅ Schéma appliqué sur la base cible.");

  // 2) Employeurs (discovered.json → table Employer).
  const employers = JSON.parse(await readFile(DISCOVERED, "utf8")) as Employer[];
  for (const e of employers) {
    const data = {
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
    await prisma.employer.upsert({ where: { id: e.id }, create: { id: e.id, ...data }, update: data });
  }
  console.log(`✅ Employeurs importés : ${employers.length}`);

  // 3) Offres (jobs.json → table Job).
  const jobs = JSON.parse(await readFile(SNAPSHOT, "utf8")) as Job[];
  const r = await upsertJobs(jobs);
  console.log(`✅ Offres importées : ${jobs.length} (${r.inserted} ajoutées, ${r.updated} MAJ)`);
  console.log("🎉 Migration Turso terminée.");
}

main()
  .catch((err) => {
    console.error("Erreur de migration :", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
