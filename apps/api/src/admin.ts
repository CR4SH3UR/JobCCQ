import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createClient, type User } from "@supabase/supabase-js";
import type { DiscoveredEmployer } from "@jobccq/shared";
import { buildDiscoveredScraper } from "./scrapers/discovered.js";
import { bespokeScraper } from "./scrapers/registry.js";
import { runScraperInstance } from "./orchestrator.js";
import { prisma } from "./db.js";
import { rowToJob } from "./repository.js";

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
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_VERIFY_KEY =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ADMIN_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://jobccqc.ca").replace(/\/+$/, "");
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

type Employer = DiscoveredEmployer & { verified?: boolean };
type AdminUserRow = {
  id: string;
  email: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  confirmedAt: string | null;
  providers: string[];
};

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

function userToRow(user: User): AdminUserRow {
  const providers = new Set<string>();
  if (typeof user.app_metadata?.provider === "string") providers.add(user.app_metadata.provider);
  const appProviders = user.app_metadata?.providers;
  if (Array.isArray(appProviders)) appProviders.forEach((p) => providers.add(String(p)));
  user.identities?.forEach((identity) => providers.add(identity.provider));
  return {
    id: user.id,
    email: user.email ?? user.phone ?? "(sans courriel)",
    createdAt: user.created_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    confirmedAt: user.email_confirmed_at ?? user.confirmed_at ?? null,
    providers: [...providers].sort(),
  };
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function requireAdminUser(req: { headers: { authorization?: string } }, reply: { code: (statusCode: number) => void }) {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) {
    reply.code(401);
    return { error: "Connexion admin requise." };
  }
  if (!SUPABASE_URL || !SUPABASE_VERIFY_KEY || !SUPABASE_ADMIN_KEY || ADMIN_EMAILS.length === 0) {
    reply.code(503);
    return { error: "Liste des utilisateurs indisponible : variables Supabase serveur manquantes." };
  }
  const verifier = createClient(SUPABASE_URL, SUPABASE_VERIFY_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await verifier.auth.getUser(token);
  const email = data.user?.email?.trim().toLowerCase();
  if (error || !email) {
    reply.code(401);
    return { error: "Session Supabase invalide." };
  }
  if (!ADMIN_EMAILS.includes(email)) {
    reply.code(403);
    return { error: "Compte non autorisé." };
  }
  return {};
}

/**
 * Garde d'accès (preHandler Fastify) : refuse toute requête sans session admin
 * valide (jeton Supabase + courriel dans ADMIN_EMAILS). À attacher à CHAQUE
 * route /admin/* pour éviter qu'un endpoint reste ouvert par oubli.
 */
export async function adminGuard(req: FastifyRequest, reply: FastifyReply) {
  const denied = await requireAdminUser(req, reply);
  if ("error" in denied) return reply.send(denied);
}

const EDITABLE = new Set(["name", "careersUrl", "method", "homepage", "region", "scope", "rbq", "sectors", "verified", "enabled"]);

export function registerAdminRoutes(app: FastifyInstance): void {
  // Liste des comptes Supabase Auth. Nécessite un appel serveur avec secret key :
  // jamais de service_role dans le navigateur.
  app.get<{ Querystring: { page?: string; perPage?: string } }>("/admin/users", async (req, reply) => {
    const denied = await requireAdminUser(req, reply);
    if ("error" in denied) return denied;

    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const perPage = Math.min(200, Math.max(1, Number(req.query.perPage ?? 100) || 100));
    const admin = createClient(SUPABASE_URL!, SUPABASE_ADMIN_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      reply.code(502);
      return { error: error.message };
    }
    return {
      page,
      perPage,
      total: data.total ?? data.users.length,
      users: data.users.map(userToRow),
    };
  });

  // Envoie une invitation Supabase Auth. Secret service_role utilisé seulement
  // ici, après vérification de la session et de la liste ADMIN_EMAILS.
  app.post<{ Body: { email?: string } }>("/admin/users/invite", async (req, reply) => {
    const denied = await requireAdminUser(req, reply);
    if ("error" in denied) return denied;

    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      reply.code(400);
      return { error: "Courriel invalide." };
    }

    const admin = createClient(SUPABASE_URL!, SUPABASE_ADMIN_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${SITE_URL}/favoris`,
    });
    if (error) {
      reply.code(502);
      return { error: error.message };
    }
    return { invited: true, email };
  });

  // Liste de tous les employeurs découverts (données fraîches du fichier).
  app.get("/admin/employers", { preHandler: adminGuard }, async () => {
    const list = await readAll();
    return { total: list.length, employers: list };
  });

  // Édition d'un employeur (nom, URL carrières, méthode, vérifié…).
  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/admin/employers/:id",
    { preHandler: adminGuard },
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
    { preHandler: adminGuard },
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
  app.delete<{ Params: { id: string } }>("/admin/employers/:id/offers", { preHandler: adminGuard }, async (req) => {
    const del = await prisma.job.deleteMany({ where: { sourceId: req.params.id } });
    return { removed: del.count };
  });

  // Édition d'une offre (titre, lieu, catégorie, description…). Identifiant = Job.id.
  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/admin/jobs/:id",
    { preHandler: adminGuard },
    async (req, reply) => {
      const existing = await prisma.job.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        reply.code(404);
        return { error: "Offre introuvable" };
      }
      const body = req.body ?? {};
      const data: Record<string, unknown> = {};
      const strFields = [
        "title",
        "company",
        "url",
        "companyLogoUrl",
        "location",
        "regionId",
        "city",
        "remote",
        "categoryId",
        "employmentType",
        "salaryPeriod",
        "currency",
        "description",
      ] as const;
      const blankToNull = (v: unknown) => {
        if (v == null) return null;
        const s = String(v).trim();
        return s === "" ? null : s;
      };
      for (const k of strFields) {
        if (k in body) data[k] = blankToNull(body[k]);
      }
      if ("title" in data && !data.title) {
        reply.code(400);
        return { error: "Le titre est requis." };
      }
      if ("company" in data && !data.company) {
        reply.code(400);
        return { error: "L'entreprise est requise." };
      }
      if ("url" in data) {
        try {
          new URL(String(data.url));
        } catch {
          reply.code(400);
          return { error: "URL invalide." };
        }
      }
      const numOrNull = (v: unknown) => {
        if (v == null || v === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      if ("salaryMin" in body) data.salaryMin = numOrNull(body.salaryMin);
      if ("salaryMax" in body) data.salaryMax = numOrNull(body.salaryMax);
      if ("tags" in body) {
        const tags = Array.isArray(body.tags)
          ? body.tags.map((t) => String(t).trim()).filter(Boolean)
          : String(body.tags ?? "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
        data.tags = JSON.stringify(tags);
      }
      if ("languages" in body) {
        const langs = Array.isArray(body.languages)
          ? body.languages.map((t) => String(t).trim()).filter(Boolean)
          : [];
        data.languages = JSON.stringify(langs);
      }
      if ("postedAt" in body) {
        const v = body.postedAt;
        if (v == null || v === "") data.postedAt = null;
        else {
          const d = typeof v === "number" ? new Date(v > 1e12 ? v : v * 1000) : new Date(String(v));
          data.postedAt = Number.isNaN(d.getTime()) ? null : d;
        }
      }
      try {
        const updated = await prisma.job.update({ where: { id: req.params.id }, data });
        return { job: rowToJob(updated) };
      } catch (err) {
        reply.code(409);
        return { error: (err as Error).message };
      }
    },
  );

  // Ajout d'un employeur depuis la console. Turso : INSERT en base ; sinon,
  // ajout au fichier discovered.json (à committer via « Publier »).
  app.post<{ Body: Record<string, unknown> }>("/admin/employers", { preHandler: adminGuard }, async (req, reply) => {
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
  app.delete<{ Params: { id: string } }>("/admin/employers/:id", { preHandler: adminGuard }, async (req) => {
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
  app.post<{ Body: { message?: string } }>("/admin/publish", { preHandler: adminGuard }, async (_req, reply) => {
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
