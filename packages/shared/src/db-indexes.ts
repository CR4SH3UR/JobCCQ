/**
 * Index SQL (SQLite / Turso) pour les filtres fréquents (idée 119).
 * `IF NOT EXISTS` : applicable à chaud depuis l'admin ou un script EXPLAIN.
 */

export const JOB_INDEX_SQL = [
  `CREATE INDEX IF NOT EXISTS "Job_company_idx" ON "Job"("company")`,
  `CREATE INDEX IF NOT EXISTS "Job_regionId_idx" ON "Job"("regionId")`,
  `CREATE INDEX IF NOT EXISTS "Job_categoryId_idx" ON "Job"("categoryId")`,
  `CREATE INDEX IF NOT EXISTS "Job_sourceId_idx" ON "Job"("sourceId")`,
  `CREATE INDEX IF NOT EXISTS "Job_postedAt_idx" ON "Job"("postedAt")`,
  `CREATE INDEX IF NOT EXISTS "Job_sourceId_url_idx" ON "Job"("sourceId", "url")`,
  `CREATE INDEX IF NOT EXISTS "Job_regionId_postedAt_idx" ON "Job"("regionId", "postedAt")`,
  `CREATE INDEX IF NOT EXISTS "Job_categoryId_postedAt_idx" ON "Job"("categoryId", "postedAt")`,
  `CREATE INDEX IF NOT EXISTS "Job_sourceId_scrapedAt_idx" ON "Job"("sourceId", "scrapedAt")`,
  `CREATE INDEX IF NOT EXISTS "Job_linkStatus_idx" ON "Job"("linkStatus")`,
  `CREATE INDEX IF NOT EXISTS "Job_company_postedAt_idx" ON "Job"("company", "postedAt")`,
] as const;

export const EMPLOYER_INDEX_SQL = [
  `CREATE INDEX IF NOT EXISTS "Employer_enabled_idx" ON "Employer"("enabled")`,
  `CREATE INDEX IF NOT EXISTS "Employer_verified_idx" ON "Employer"("verified")`,
] as const;
