import { defineConfig, env } from "prisma/config";

/**
 * Configuration du CLI Prisma (Prisma 7+).
 *
 * Depuis Prisma 7, la propriété `url` de la datasource ne vit plus dans
 * `schema.prisma` : l'URL de connexion (pour `prisma db push` / `migrate`)
 * se déclare ici. Le client applicatif, lui, se connecte via un **adaptateur
 * de pilote** (libSQL) construit dans `src/db.ts` — c'est désormais requis
 * pour toutes les bases (le moteur Rust embarqué a été retiré).
 *
 * `DATABASE_URL` est fourni en ligne par les scripts npm
 * (`DATABASE_URL=file:./prisma/dev.db prisma …`) ; en CI/prod on cible Turso.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
