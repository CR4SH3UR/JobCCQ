import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { FastifyInstance } from "fastify";
import type { DiscoveredEmployer } from "@jobccq/shared";
import { buildDiscoveredScraper } from "./scrapers/discovered.js";
import { bespokeScraper } from "./scrapers/registry.js";
import { runScraperInstance } from "./orchestrator.js";
import { prisma } from "./db.js";

/**
 * Routes de la **console d'administration** (usage local, API branchée).
 * Permettent de lister les employeurs, corriger leurs URLs/nom, les marquer
 * « vérifiés »/désactivés, et relancer le scraping d'un seul site.
 *
 * Stockage : si Turso est configuré (TURSO_DATABASE_URL), les lectures et
 * écritures passent par la **table Employer** (base partagée) ; sinon, par le
 * fichier packages/shared/src/discovered.json (à committer).
 */
const DP = resolve(dirname(fileURLToPath(import.meta.url)), "../../../packages/shared/src/discovered.json");
const REPO_ROOT = resolve(dirname(DP), "../../..");
const REL_DP = "packages/shared/src/discovered.json";
const exec = promisify(execFile);

const USE_TURSO = !!process.env.TURSO_DATABASE_URL;

type Employer = DiscoveredEmployer & { verified?: boolean };

/** Ligne Prisma Employer → forme DiscoveredEmployer de l'API. */
function rowToEmployer(row: {
  id: string; name: string; homepage: string; careersUrl: string; method: string;
  region: string | null; rbq: string | null; scope: string | null; sectors: string;
  verified: boolean; enabled: boolean;
}): Employer {
  return {
    id: row.id,
    name: row.name,
    homepage: row.homepage,
    careersUrl: row.careersUrl,
    method: row.method as DiscoveredEmployer["method"],
    ...(row.region ? { region: row.region } : {}),
    ...(row.rbq ? { rbq: row.rbq } : {}),
    ...(row.scope ? { scope: row.scope } : {}),
    sectors: JSON.parse(row.sectors || "[]"),
    ...(row.verified ? { verified: true } : {}),
    ...(row.enabled === false ? { enabled: false } : {}),
  } as Employer;
}

async function readAll(): Promise<Employer[]> {
  if (USE_TURSO) {
    const rows = await prisma.employer.findMany({ orderBy: { id: "asc" } });
    return rows.map(rowToEmployer);
  }
  return JSON.parse(await readFile(DP, "utf8")) as Employer[];
}
async function writeAll(list: Employer[]): Promise<void> {
  await writeFile(DP, JSON.stringify(list, null, 2) + "\n");
}

const EDITABLE = new Set(["name", "careersUrl", "method", "homepage", "region", "scope", "rbq", "sectors", "verified", "enabled"]);

export function registerAdminRoutes(app: FastifyInstance): void {
  // Liste de tous les employeurs découverts (données fraîches du fichier).
  app.get("/admin/employers", async () => {
    const list = await readAll();
    return { total: list.length, employers: list };
  });

  // Édition d'un employeur (nom, URL carrières, méthode, vérifié…).
  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/admin/employers/:id",
    async (req, reply) => {
      const list = await readAll();
      const idx = list.findIndex((e) => e.id === req.params.id);
      if (idx < 0) {
        reply.code(404);
        return { error: "Employeur introuvable" };
      }
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(req.body ?? {})) {
        if (EDITABLE.has(k)) patch[k] = v;
      }
      if (USE_TURSO) {
        // Écriture directe dans la table Employer (base partagée).
        const data: Record<string, unknown> = {};
        for (const k of ["name", "careersUrl", "method", "homepage", "region", "scope", "rbq"]) {
          if (k in patch) data[k] = patch[k];
        }
        if ("sectors" in patch) data.sectors = JSON.stringify(patch.sectors ?? []);
        if ("verified" in patch) data.verified = !!patch.verified;
        if ("enabled" in patch) data.enabled = patch.enabled !== false;
        const updated = await prisma.employer
          .update({ where: { id: req.params.id }, data })
          .catch(() => null);
        if (!updated) {
          reply.code(404);
          return { error: "Employeur introuvable" };
        }
        return { employer: rowToEmployer(updated) };
      }
      list[idx] = { ...list[idx], ...patch } as Employer;
      await writeAll(list);
      return { employer: list[idx] };
    },
  );

  // Relance le scraping d'UN employeur avec sa config actuelle (URL éditée
  // prise en compte immédiatement). Persiste en base et renvoie un aperçu.
  app.post<{ Params: { id: string }; Body: { maxPages?: number } }>(
    "/admin/employers/:id/scrape",
    async (req, reply) => {
      const list = await readAll();
      const employer = list.find((e) => e.id === req.params.id);
      if (!employer) {
        reply.code(404);
        return { error: "Employeur introuvable" };
      }
      // Scraper sur mesure s'il en existe un (EBC, Pomerleau, Béluga…), sinon on
      // reconstruit depuis la config éditée (prend en compte une URL modifiée).
      const scraper = bespokeScraper(employer.id) ?? buildDiscoveredScraper(employer);
      const { report, jobs } = await runScraperInstance(scraper, {
        maxPages: req.body?.maxPages ?? 2,
      });
      return {
        report,
        sample: jobs.slice(0, 12).map((j) => ({ title: j.title, city: j.city, url: j.url })),
      };
    },
  );

  // Supprime TOUTES les offres d'un employeur (remise à zéro). Sert à repartir
  // proprement quand un employeur était mal configuré et a accumulé de fausses
  // offres que le garde-fou anti-purge protège (ex. Balvent). Après ça, un
  // re-scrape avec la bonne config repart de 0.
  app.delete<{ Params: { id: string } }>("/admin/employers/:id/offers", async (req) => {
    const del = await prisma.job.deleteMany({ where: { sourceId: req.params.id } });
    return { removed: del.count };
  });

  // Ajout d'un employeur depuis la console. Turso : INSERT en base ; sinon,
  // ajout au fichier discovered.json (à committer via « Publier »).
  app.post<{ Body: Record<string, unknown> }>("/admin/employers", async (req, reply) => {
    const b = req.body ?? {};
    const id = String(b.id ?? "").trim();
    const name = String(b.name ?? "").trim();
    const careersUrl = String(b.careersUrl ?? "").trim();
    if (!id || !name || !careersUrl) {
      reply.code(400);
      return { error: "id, name et careersUrl sont requis." };
    }
    let homepage = String(b.homepage ?? "").trim();
    if (!homepage) {
      try {
        homepage = new URL(careersUrl).origin;
      } catch {
        homepage = careersUrl;
      }
    }
    const method = String(b.method ?? "html");
    const region = b.region ? String(b.region) : null;
    if (USE_TURSO) {
      const created = await prisma.employer
        .create({ data: { id, name, homepage, careersUrl, method, region, sectors: "[]" } })
        .catch(() => null);
      if (!created) {
        reply.code(409);
        return { error: "Création impossible (id déjà utilisé ?)." };
      }
      return { employer: rowToEmployer(created) };
    }
    const list = await readAll();
    if (list.some((e) => e.id === id)) {
      reply.code(409);
      return { error: "id déjà utilisé." };
    }
    const emp = { id, name, homepage, careersUrl, method, ...(region ? { region } : {}), sectors: [] } as Employer;
    list.push(emp);
    await writeAll(list);
    return { employer: emp };
  });

  // Suppression définitive d'un employeur (sa fiche + toutes ses offres).
  app.delete<{ Params: { id: string } }>("/admin/employers/:id", async (req) => {
    const id = req.params.id;
    const del = await prisma.job.deleteMany({ where: { sourceId: id } });
    if (USE_TURSO) {
      await prisma.employer.delete({ where: { id } }).catch(() => null);
    } else {
      const list = await readAll();
      await writeAll(list.filter((e) => e.id !== id));
    }
    return { removed: del.count, deleted: id };
  });

  // Publie discovered.json : git add + commit + push → redéploiement du site.
  // (Endpoint local : utilise les identifiants git de la machine.)
  app.post<{ Body: { message?: string } }>("/admin/publish", async (_req, reply) => {
    // Avec Turso, les écritures sont déjà persistées en base : rien à committer.
    // Le site se reconstruit depuis Turso au prochain déploiement.
    if (USE_TURSO) {
      return {
        published: true,
        message: "Enregistré dans Turso. Le site se reconstruira au prochain déploiement.",
      };
    }
    const git = (args: string[]) => exec("git", args, { cwd: REPO_ROOT });
    try {
      await git(["add", REL_DP]);
      // Rien à publier ?
      const status = await git(["status", "--porcelain", REL_DP]);
      if (!status.stdout.trim()) {
        return { published: false, message: "Aucun changement à publier." };
      }
      await git(["commit", "-m", _req.body?.message?.slice(0, 200) || "Admin : mise à jour des employeurs"]);
      await git(["push"]);
      const head = (await git(["rev-parse", "--short", "HEAD"])).stdout.trim();
      return { published: true, commit: head, message: "Publié — le site va se redéployer." };
    } catch (err) {
      reply.code(500);
      return { published: false, error: (err as Error).message };
    }
  });
}
