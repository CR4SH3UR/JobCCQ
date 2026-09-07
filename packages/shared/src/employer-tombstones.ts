/**
 * Employeurs volontairement retirés (supprimés ou fusionnés).
 *
 * Sans cette ancre, `sync:employers` réinsère toute fiche encore présente dans
 * `discovered.json` (git) dès qu'elle disparaît de Turso — les doublons
 * reviennent au scrape / déploiement suivant.
 */

export type EmployerTombstoneReason = "deleted" | "merged";

export interface EmployerTombstone {
  id: string;
  reason: EmployerTombstoneReason;
  mergedInto?: string | null;
  createdAt?: string;
}

/** DDL idempotent (SQLite / Turso), appliqué à chaud depuis l'API et l'admin. */
export const EMPLOYER_TOMBSTONE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "EmployerTombstone" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reason" TEXT NOT NULL,
  "mergedInto" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

export function dropRetiredEmployers<T extends { id: string }>(
  list: readonly T[],
  retiredIds: ReadonlySet<string>,
): T[] {
  if (retiredIds.size === 0) return [...list];
  return list.filter((e) => !retiredIds.has(e.id));
}

export function addRetiredIds(current: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  const next = new Set(current);
  for (const id of ids) {
    const t = id.trim();
    if (t) next.add(t);
  }
  return next;
}

export function removeRetiredId(current: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(current);
  next.delete(id);
  return next;
}
