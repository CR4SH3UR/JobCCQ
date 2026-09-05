import { prisma } from "./db.js";

/**
 * Table éditable **Municipality** (municipalité → région administrative). Gérée
 * par la console admin ; consultée à l'export pour reclasser les offres selon
 * leur ville. On passe par du SQL brut (adaptateur libSQL) plutôt qu'un modèle
 * Prisma, pour éviter une migration de schéma sur la base Turso de production.
 */

/** Normalise un nom de municipalité pour la comparaison (sans accents, en slug). */
export function normMuni(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureTable(): Promise<void> {
  await prisma.$executeRawUnsafe(
    "CREATE TABLE IF NOT EXISTS Municipality (norm TEXT PRIMARY KEY, name TEXT NOT NULL, regionId TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT '')",
  );
}

export interface MunicipalityRow {
  name: string;
  regionId: string;
}

export async function listMunicipalities(): Promise<MunicipalityRow[]> {
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<MunicipalityRow[]>(
    "SELECT name, regionId FROM Municipality ORDER BY name COLLATE NOCASE",
  );
  return rows.map((r) => ({ name: r.name, regionId: r.regionId }));
}

export async function upsertMunicipality(name: string, regionId: string): Promise<void> {
  await ensureTable();
  await prisma.$executeRawUnsafe(
    "INSERT INTO Municipality (norm, name, regionId, createdAt) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT(norm) DO UPDATE SET name = excluded.name, regionId = excluded.regionId",
    normMuni(name),
    name.trim(),
    regionId,
    new Date().toISOString(),
  );
}

export async function deleteMunicipality(name: string): Promise<void> {
  await ensureTable();
  await prisma.$executeRawUnsafe("DELETE FROM Municipality WHERE norm = ?", normMuni(name));
}

/** Charge la table sous forme de Map (clé normalisée → id de région). */
export async function loadMunicipalityMap(): Promise<Map<string, string>> {
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<{ norm: string; regionId: string }[]>(
    "SELECT norm, regionId FROM Municipality",
  );
  return new Map(rows.map((r) => [r.norm, r.regionId]));
}
