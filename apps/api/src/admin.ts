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

/**
 * Routes de la **console d'administration** (usage local, API branchée).
 * Permettent de lister les employeurs découverts, corriger leurs URLs/nom,
 * les marquer « vérifiés », et relancer le scraping d'un seul site.
 * Les écritures modifient packages/shared/src/discovered.json (à committer).
 */
const DP = resolve(dirname(fileURLToPath(import.meta.url)), "../../../packages/shared/src/discovered.json");
const REPO_ROOT = resolve(dirname(DP), "../../..");
const REL_DP = "packages/shared/src/discovered.json";
const exec = promisify(execFile);

type Employer = DiscoveredEmployer & { verified?: boolean };

async function readAll(): Promise<Employer[]> {
  return JSON.parse(await readFile(DP, "utf8")) as Employer[];
}
async function writeAll(list: Employer[]): Promise<void> {
  await writeFile(DP, JSON.stringify(list, null, 2) + "\n");
}

const EDITABLE = new Set(["name", "careersUrl", "method", "homepage", "region", "scope", "verified", "enabled"]);

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

  // Publie discovered.json : git add + commit + push → redéploiement du site.
  // (Endpoint local : utilise les identifiants git de la machine.)
  app.post<{ Body: { message?: string } }>("/admin/publish", async (_req, reply) => {
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
