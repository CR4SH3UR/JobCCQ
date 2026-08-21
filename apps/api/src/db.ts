import "./env.js";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

/** Client Prisma singleton (évite d'épuiser les connexions en dev/hot-reload). */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const logLevels: ("query" | "warn" | "error")[] = process.env.PRISMA_LOG
  ? ["query", "warn", "error"]
  : ["warn", "error"];

function makeClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    // Turso / libSQL (compatible SQLite) via l'adaptateur de pilote Prisma.
    // Une seule base partagée par le scraping, l'API d'admin et l'export.
    const libsql = createClient({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter, log: logLevels });
  }
  // Défaut développement : fichier SQLite local (DATABASE_URL).
  return new PrismaClient({ log: logLevels });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
