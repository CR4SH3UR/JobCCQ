import { EMPLOYER_INDEX_SQL, EMPLOYER_TOMBSTONE_TABLE_SQL, JOB_INDEX_SQL } from "@jobccq/shared";

/** Accès Turso depuis le navigateur (même coffre que la console employeurs). */

export const LS_TURSO_URL = "admin:tursourl";
export const LS_TURSO_TOKEN = "admin:tursotoken";

export function readLS(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export async function tursoRows(
  url: string,
  token: string,
  sql: string,
  args: unknown[] = [],
): Promise<Record<string, unknown>[]> {
  const { createClient } = await import("@libsql/client/web");
  const client = createClient({
    url: url.trim().replace(/^libsql:\/\//i, "https://"),
    authToken: token.trim(),
  });
  const res = await client.execute({ sql, args: args as never[] });
  return res.rows as unknown as Record<string, unknown>[];
}

export async function tursoExec(url: string, token: string, sql: string, args: unknown[] = []): Promise<number> {
  const { createClient } = await import("@libsql/client/web");
  const client = createClient({
    url: url.trim().replace(/^libsql:\/\//i, "https://"),
    authToken: token.trim(),
  });
  const res = await client.execute({ sql, args: args as never[] });
  return res.rowsAffected ?? 0;
}

/** Ajoute les colonnes admin récentes si elles n'existent pas encore (Turso). */
export async function ensureTursoAdminColumns(url: string, token: string): Promise<void> {
  await tursoExec(url, token, "ALTER TABLE Employer ADD COLUMN notes TEXT").catch(() => {});
  await tursoExec(url, token, "ALTER TABLE Employer ADD COLUMN careersUrl2 TEXT").catch(() => {});
  await tursoExec(url, token, "ALTER TABLE Employer ADD COLUMN method2 TEXT").catch(() => {});
  await tursoExec(url, token, "ALTER TABLE ScrapeRun ADD COLUMN diffJson TEXT").catch(() => {});
  await tursoExec(url, token, "ALTER TABLE Job ADD COLUMN linkStatus TEXT").catch(() => {});
  await tursoExec(url, token, "ALTER TABLE Job ADD COLUMN historyJson TEXT").catch(() => {});
  await tursoExec(url, token, "ALTER TABLE ScrapeRun ADD COLUMN rollbackJson TEXT").catch(() => {});
  await tursoExec(url, token, EMPLOYER_TOMBSTONE_TABLE_SQL).catch(() => {});
  for (const sql of [...JOB_INDEX_SQL, ...EMPLOYER_INDEX_SQL]) {
    await tursoExec(url, token, sql).catch(() => {});
  }
}

export async function fetchEmployerTombstones(
  url: string,
  token: string,
): Promise<{ id: string; reason: string; mergedInto: string | null }[]> {
  await tursoExec(url, token, EMPLOYER_TOMBSTONE_TABLE_SQL).catch(() => {});
  const rows = await tursoRows(url, token, "SELECT id, reason, mergedInto FROM EmployerTombstone").catch(() => []);
  return rows
    .map((r) => ({
      id: String(r.id ?? ""),
      reason: String(r.reason ?? "deleted"),
      mergedInto: r.mergedInto == null || r.mergedInto === "" ? null : String(r.mergedInto),
    }))
    .filter((r) => r.id);
}

export async function fetchRetiredEmployerIds(url: string, token: string): Promise<string[]> {
  return (await fetchEmployerTombstones(url, token)).map((r) => r.id);
}

export async function recordEmployerTombstone(
  url: string,
  token: string,
  id: string,
  reason: "deleted" | "merged",
  mergedInto?: string | null,
): Promise<void> {
  await tursoExec(url, token, EMPLOYER_TOMBSTONE_TABLE_SQL).catch(() => {});
  await tursoExec(
    url,
    token,
    "INSERT OR REPLACE INTO EmployerTombstone (id, reason, mergedInto, createdAt) VALUES (?,?,?,?)",
    [id, reason, mergedInto ?? null, new Date().toISOString()],
  );
}

export async function clearEmployerTombstone(url: string, token: string, id: string): Promise<void> {
  await tursoExec(url, token, "DELETE FROM EmployerTombstone WHERE id=?", [id]).catch(() => {});
}

/** Change l'id d'une fiche Turso et réassigne offres + historique de scrape. */
export async function renameEmployerId(
  url: string,
  token: string,
  oldId: string,
  newId: string,
): Promise<{ jobsMoved: number; runsMoved: number }> {
  const clash = await tursoRows(url, token, "SELECT id FROM Employer WHERE id=?", [newId]);
  if (clash.length) throw new Error(`L'id « ${newId} » est déjà utilisé.`);
  const exists = await tursoRows(url, token, "SELECT id FROM Employer WHERE id=?", [oldId]);
  if (!exists.length) throw new Error("Employeur introuvable.");
  const now = new Date().toISOString();
  const n = await tursoExec(url, token, "UPDATE Employer SET id=?, updatedAt=? WHERE id=?", [newId, now, oldId]);
  if (n === 0) throw new Error("Employeur introuvable.");
  const jobsMoved = await tursoExec(url, token, "UPDATE Job SET sourceId=? WHERE sourceId=?", [newId, oldId]);
  const runsMoved = await tursoExec(url, token, "UPDATE ScrapeRun SET sourceId=? WHERE sourceId=?", [
    newId,
    oldId,
  ]);
  await recordEmployerTombstone(url, token, oldId, "merged", newId);
  await clearEmployerTombstone(url, token, newId);
  return { jobsMoved, runsMoved };
}

export function tursoCreds(): { url: string; token: string } | null {
  const url = readLS(LS_TURSO_URL);
  const token = readLS(LS_TURSO_TOKEN);
  return url && token ? { url, token } : null;
}
