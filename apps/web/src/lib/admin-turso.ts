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
  await tursoExec(url, token, "ALTER TABLE ScrapeRun ADD COLUMN diffJson TEXT").catch(() => {});
  await tursoExec(url, token, "ALTER TABLE Job ADD COLUMN linkStatus TEXT").catch(() => {});
  await tursoExec(url, token, "ALTER TABLE Job ADD COLUMN historyJson TEXT").catch(() => {});
  await tursoExec(url, token, "ALTER TABLE ScrapeRun ADD COLUMN rollbackJson TEXT").catch(() => {});
}

export function tursoCreds(): { url: string; token: string } | null {
  const url = readLS(LS_TURSO_URL);
  const token = readLS(LS_TURSO_TOKEN);
  return url && token ? { url, token } : null;
}
