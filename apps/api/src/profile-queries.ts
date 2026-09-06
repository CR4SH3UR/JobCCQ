/**
 * Requêtes fréquentes (filtres / scrape / stats) + EXPLAIN QUERY PLAN
 * (idée 119). À lancer sur SQLite local ou Turso :
 *
 *   npm run profile:queries -w @jobccq/api
 */
export { EMPLOYER_INDEX_SQL, JOB_INDEX_SQL } from "@jobccq/shared";

export interface ProfiledQuery {
  id: string;
  /** Ce que ça sert dans l'app. */
  why: string;
  sql: string;
}

/** Filtres / lectures les plus fréquents (Turso + SQLite). */
export const FREQUENT_QUERIES: ProfiledQuery[] = [
  {
    id: "job-by-id",
    why: "fiche offre",
    sql: `SELECT * FROM "Job" WHERE "id" = 'j1'`,
  },
  {
    id: "job-by-url",
    why: "upsert scrape",
    sql: `SELECT "url", "title" FROM "Job" WHERE "url" = 'https://ex.test/a'`,
  },
  {
    id: "jobs-by-source",
    why: "sync / purge d'un employeur",
    sql: `SELECT "id" FROM "Job" WHERE "sourceId" = 'hamel-construction'`,
  },
  {
    id: "jobs-region-recent",
    why: "filtre région + tri date",
    sql: `SELECT "id" FROM "Job" WHERE "regionId" = 'montreal' ORDER BY "postedAt" DESC`,
  },
  {
    id: "jobs-category-recent",
    why: "filtre domaine + tri date",
    sql: `SELECT "id" FROM "Job" WHERE "categoryId" = 'construction' ORDER BY "postedAt" DESC`,
  },
  {
    id: "jobs-company",
    why: "offres similaires / doublons",
    sql: `SELECT "id" FROM "Job" WHERE "company" = 'Hamel' LIMIT 80`,
  },
  {
    id: "jobs-link-gone",
    why: "sonde liens 404",
    sql: `SELECT "id" FROM "Job" WHERE "linkStatus" = 'gone'`,
  },
  {
    id: "stats-by-region",
    why: "facettes accueil",
    sql: `SELECT "regionId", COUNT(*) FROM "Job" GROUP BY "regionId"`,
  },
  {
    id: "employers-enabled",
    why: "registre scrapers",
    sql: `SELECT "id" FROM "Employer" WHERE "enabled" = 1`,
  },
];

export type ExplainRow = { detail: string };

/** True si le plan utilise un index (SEARCH / USING INDEX), pas un SCAN nu. */
export function planUsesIndex(details: string[]): boolean {
  const text = details.join("\n");
  if (/USING (?:COVERING )?INDEX/i.test(text)) return true;
  if (/SEARCH /i.test(text) && /INDEX/i.test(text)) return true;
  return false;
}

/** SCAN TABLE sans index nommé = lecture complète (coûteux sur Turso). */
export function planIsFullScan(details: string[]): boolean {
  const text = details.join("\n");
  if (planUsesIndex(details)) return false;
  return /SCAN (?:TABLE )?"?(Job|Employer)"?/i.test(text);
}

export function summarizeExplain(id: string, details: string[]): {
  id: string;
  usesIndex: boolean;
  fullScan: boolean;
  plan: string;
} {
  return {
    id,
    usesIndex: planUsesIndex(details),
    fullScan: planIsFullScan(details),
    plan: details.join(" | "),
  };
}
