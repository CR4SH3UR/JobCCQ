/**
 * Exporte les employeurs de la base (Turso en prod) vers
 * packages/shared/src/discovered.json — l'inverse de turso-migrate.
 *
 * Utilisé au build du site (workflow de déploiement) quand Turso est configuré :
 * le site statique reflète alors la base, sans exposer de jeton au navigateur.
 * Les offres suivent le même chemin via `export:static --from-db`.
 */
import "./env.js";
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma, ensureSchemaColumns } from "./db.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../../../packages/shared/src/discovered.json");

async function main() {
  await ensureSchemaColumns();
  const rows = await prisma.employer.findMany({ orderBy: { id: "asc" } });
  const list = rows.map((e) => {
    // Même forme (et ordre de champs) que DiscoveredEmployer / discovered.json.
    const o: Record<string, unknown> = {
      id: e.id,
      name: e.name,
      homepage: e.homepage,
      careersUrl: e.careersUrl,
      method: e.method,
    };
    if (e.region) o.region = e.region;
    if (e.rbq) o.rbq = e.rbq;
    if (e.scope) o.scope = e.scope;
    o.sectors = JSON.parse(e.sectors || "[]");
    if (e.verified) o.verified = true;
    if (!e.enabled) o.enabled = false;
    if (e.careersUrl2) o.careersUrl2 = e.careersUrl2;
    if (e.method2) o.method2 = e.method2;
    return o;
  });
  await writeFile(OUT, JSON.stringify(list, null, 2) + "\n");
  console.log(`✅ ${list.length} employeurs exportés depuis la base vers ${OUT}`);
}

main()
  .catch((err) => {
    console.error("Erreur d'export des employeurs :", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
