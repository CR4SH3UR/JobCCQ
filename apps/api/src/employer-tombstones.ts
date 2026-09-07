/**
 * Ancres d'employeurs retirés (Turso / SQLite).
 * DDL + lectures/écritures en SQL brut : la table est créée à chaud si absente.
 */
import { EMPLOYER_TOMBSTONE_TABLE_SQL, type EmployerTombstoneReason } from "@jobccq/shared";
import { prisma } from "./db.js";
import { reassignJobsToEmployer } from "./repository.js";

export type EmployerTombstoneRow = {
  id: string;
  reason: string;
  mergedInto: string | null;
};

export async function ensureEmployerTombstoneTable(): Promise<void> {
  await prisma.$executeRawUnsafe(EMPLOYER_TOMBSTONE_TABLE_SQL);
}

export async function listEmployerTombstones(): Promise<EmployerTombstoneRow[]> {
  await ensureEmployerTombstoneTable();
  const rows = await prisma.$queryRawUnsafe<EmployerTombstoneRow[]>(
    `SELECT id, reason, "mergedInto" AS mergedInto FROM EmployerTombstone`,
  );
  return rows ?? [];
}

export async function listRetiredEmployerIds(): Promise<Set<string>> {
  const rows = await listEmployerTombstones();
  return new Set(rows.map((r) => r.id));
}

export async function recordEmployerTombstone(
  id: string,
  reason: EmployerTombstoneReason,
  mergedInto?: string | null,
): Promise<void> {
  await ensureEmployerTombstoneTable();
  const now = new Date().toISOString();
  await prisma.$executeRaw`
    INSERT OR REPLACE INTO EmployerTombstone (id, reason, mergedInto, createdAt)
    VALUES (${id}, ${reason}, ${mergedInto ?? null}, ${now})
  `;
}

export async function clearEmployerTombstone(id: string): Promise<void> {
  await ensureEmployerTombstoneTable();
  await prisma.$executeRaw`DELETE FROM EmployerTombstone WHERE id = ${id}`;
}

/**
 * Si un scrape / sync antérieur a recréé une fiche ancrée, on la retire à
 * nouveau (et on réassigne ou on purge ses offres).
 */
export async function applyEmployerTombstones(): Promise<number> {
  const stones = await listEmployerTombstones();
  if (!stones.length) return 0;
  let removed = 0;
  for (const s of stones) {
    const stillThere = await prisma.employer.findUnique({
      where: { id: s.id },
      select: { id: true },
    });
    if (s.reason === "merged" && s.mergedInto) {
      const keep = await prisma.employer.findUnique({
        where: { id: s.mergedInto },
        select: { name: true },
      });
      if (keep) await reassignJobsToEmployer(s.mergedInto, s.id, keep.name);
      else await prisma.job.deleteMany({ where: { sourceId: s.id } });
    } else {
      await prisma.job.deleteMany({ where: { sourceId: s.id } });
    }
    if (stillThere) {
      await prisma.employer.delete({ where: { id: s.id } }).catch(() => null);
      removed += 1;
    }
  }
  return removed;
}
