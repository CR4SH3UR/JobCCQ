import "./env.js";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import { EMPLOYER_TOMBSTONE_TABLE_SQL } from "@jobccq/shared";

/** Client Prisma singleton (évite d'épuiser les connexions en dev/hot-reload). */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  schemaReady?: Promise<void>;
};

/**
 * Ajoute les colonnes admin récentes si la base distante (Turso) n'a pas encore
 * été `db push`. Sans ça, Prisma 7 SELECT toutes les colonnes du schéma
 * (`Employer.notes`, `ScrapeRun.diffJson`) et le CI plante (SQL_INPUT_ERROR).
 */
export async function ensureSchemaColumns(): Promise<void> {
  if (!globalForPrisma.schemaReady) {
    globalForPrisma.schemaReady = (async () => {
      const tursoUrl = process.env.TURSO_DATABASE_URL;
      const url = tursoUrl ?? process.env.DATABASE_URL ?? "file:./dev.db";
      const client = createClient({
        url,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
      try {
        await client.execute("ALTER TABLE Employer ADD COLUMN notes TEXT").catch(() => {});
        await client.execute("ALTER TABLE Employer ADD COLUMN careersUrl2 TEXT").catch(() => {});
        await client.execute("ALTER TABLE Employer ADD COLUMN method2 TEXT").catch(() => {});
        await client.execute("ALTER TABLE ScrapeRun ADD COLUMN diffJson TEXT").catch(() => {});
        await client.execute("ALTER TABLE Job ADD COLUMN linkStatus TEXT").catch(() => {});
        await client.execute("ALTER TABLE Job ADD COLUMN historyJson TEXT").catch(() => {});
        await client.execute("ALTER TABLE ScrapeRun ADD COLUMN rollbackJson TEXT").catch(() => {});
        await client.execute(EMPLOYER_TOMBSTONE_TABLE_SQL).catch(() => {});
      } finally {
        client.close();
      }
    })();
  }
  await globalForPrisma.schemaReady;
}

const logLevels: ("query" | "warn" | "error")[] = process.env.PRISMA_LOG
  ? ["query", "warn", "error"]
  : ["warn", "error"];

function makeClient(): PrismaClient {
  // Prisma 7 a retiré le moteur Rust embarqué : un **adaptateur de pilote** est
  // désormais requis pour TOUTES les bases. libSQL couvre les deux cas d'un seul
  // adaptateur (l'adaptateur construit lui-même son client à partir de l'URL) :
  //  - prod : Turso (URL distante + jeton) — base partagée scraping/admin/export ;
  //  - dev  : fichier SQLite local via une URL `file:` (DATABASE_URL).
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const adapter = tursoUrl
    ? new PrismaLibSql({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN })
    : new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  const base = new PrismaClient({ adapter, log: logLevels });
  // Toute requête Prisma attend la migration légère (colonnes manquantes).
  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        await ensureSchemaColumns();
        return query(args);
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
