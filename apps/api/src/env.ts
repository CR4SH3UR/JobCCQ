// Valeur par défaut pour un démarrage « zéro configuration » en développement.
// (Le chemin est relatif au dossier apps/api, cwd des scripts npm du workspace.)
process.env.DATABASE_URL ||= "file:./prisma/dev.db";

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  HOST: process.env.HOST ?? "0.0.0.0",
  DATABASE_URL: process.env.DATABASE_URL,
  /** Rythme poli entre deux requêtes de scraping (ms). */
  SCRAPE_DELAY_MS: Number(process.env.SCRAPE_DELAY_MS ?? 1500),
  USER_AGENT:
    process.env.SCRAPE_USER_AGENT ??
    "JobCCQ/0.1 (+https://github.com/cr4sh3ur/jobccq) agrégateur d'emplois",
};
