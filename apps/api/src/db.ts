import "./env.js";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

/** Client Prisma singleton (évite d'épuiser les connexions en dev/hot-reload). */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

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
    : new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
  return new PrismaClient({ adapter, log: logLevels });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
