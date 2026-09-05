"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DISCOVERED_EMPLOYERS, QUEBEC_REGIONS, hasCustomScraper, type DiscoveredMethod, type Job } from "@jobccq/shared";
import { API_URL, getStats, searchJobs, buildQuery, adminFetch, invalidateJobOverrides } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { encryptJson, decryptJson, saveVault, loadVault, clearVault, type AdminSecrets } from "@/lib/vault";
import { notifyJobsChanged } from "@/lib/live";
import { upsertJobOverride } from "@/lib/job-overrides";
import { supabaseEnabled } from "@/lib/supabase";
import { logAudit, setAuditActor, useAuditLog, clearAudit } from "@/lib/admin-audit";
import { diffDiscovered, type DiscoveredDiff, type DiffEmployer } from "@/lib/discovered-diff";
import { Badge } from "./Badge";
import { AdminOfferEditor, type OfferPatch, type OfferRow, type SaveState } from "./AdminOfferEditor";

/**
 * Régions administratives du Québec sélectionnables pour un employeur. On exclut
 * télétravail / hors-Québec / non précisé (non pertinents pour le LIEU d'un
 * employeur). Le libellé sans parenthèse correspond au format stocké et se
 * « slugifie » vers l'id de région attendu par la chaîne de traitement.
 */
const REGION_OPTIONS = QUEBEC_REGIONS.filter(
  (r) => !["teletravail", "canada-autre", "autre"].includes(r.id),
).map((r) => r.label.replace(/\s*\(.*\)\s*$/, ""));

type Employer = {
  id: string;
  name: string;
  homepage: string;
  careersUrl: string;
  method: DiscoveredMethod;
  region?: string;
  rbq?: string;
  scope?: string;
  sectors?: readonly string[];
  verified?: boolean;
  enabled?: boolean;
};

type Mode = "loading" | "api" | "static" | "turso";
type ScrapeState = { status: "run" | "ok" | "err"; found?: number; error?: string; sample?: { title: string; city?: string }[] };
/** Dernière exécution de scraping connue pour un employeur (table ScrapeRun). */
type LastRun = { status: string; at: number | null; found: number; error?: string };
type OffersState = { loading: boolean; rows: OfferRow[]; error?: string };
/** Retour d'enregistrement d'une fiche employeur (mode Turso/API/local). */
/** Une ligne du flux d'activité (exécutions de scraping récentes, toutes sources). */
type ActivityRow = {
  id: number; sourceId: string; status: string;
  found: number; inserted: number; updated: number; error?: string; at: number | null;
};

const METHODS: DiscoveredMethod[] = [
  "html", "jsonld", "zoho", "bamboohr", "greenhouse", "lever",
  "recruitee", "smartrecruiters", "teamtailor", "ultipro", "jobillico",
];
const PAGE_SIZE = 40;
const PAGE_SIZES = [40, 100, 250] as const;
const LS_EDITS = "admin:edits";
const LS_VERIF = "admin:verified";
const LS_TOKEN = "admin:ghtoken";
const LS_TURSO_URL = "admin:tursourl";
const LS_TURSO_TOKEN = "admin:tursotoken";
const LS_SEARCH = "admin:search";
const LS_FILTER = "admin:filter";
const LS_SORT = "admin:sort";
const LS_METHOD = "admin:method";
const LS_REGION = "admin:region";
const LS_PAGESIZE = "admin:pagesize";
const DISCOVERED_PATH = "packages/shared/src/discovered.json";

/** Libellés lisibles des actions du journal d'audit (#45). */
const AUDIT_LABEL: Record<string, string> = {
  edit: "Édition",
  scrape: "Re-scrape",
  "scrape-force": "Re-scrape forcé",
  "scrape-all": "Scrape complet",
  purge: "Purge d'offres",
  delete: "Suppression",
  publish: "Publication",
  redeploy: "Redéploiement",
};

/** Colonnes lues pour l'aperçu déroulant « Offres » d'un employeur (mode Turso). */
const OFFERS_SQL =
  `SELECT id, title, company, url, location, city, regionId, remote, categoryId, employmentType,
          salaryMin, salaryMax, salaryPeriod, currency, description, tags, languages, postedAt, companyLogoUrl
   FROM Job WHERE sourceId=? ORDER BY id DESC LIMIT 60`;

/** Filtres du tableau (persistés dans le navigateur → survivent au rafraîchissement). */
const FILTER_KEYS = ["all", "unverified", "verified", "customscraper", "generic", "nojobs", "disabled", "duplicates", "errors", "neverrun"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
/** Tri du tableau. */
const SORT_KEYS = ["name", "jobsDesc", "jobsAsc", "method", "region", "lastRun"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const SORT_LABELS: Record<SortKey, string> = {
  name: "Nom (A→Z)",
  jobsDesc: "Offres (plus→moins)",
  jobsAsc: "Offres (moins→plus)",
  method: "Méthode",
  region: "Région",
  lastRun: "Dernier scrape",
};

/** Lecture directe (hors state React) d'une clé localStorage. */
function readLS(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

/** Message d'erreur du coffre plus parlant (table Supabase absente…). */
function hintVaultError(msg: string): string {
  if (/admin_secrets|could not find the table|schema cache|relation .* does not exist/i.test(msg)) {
    return "Table « admin_secrets » absente côté Supabase. Exécute le SQL d'installation (fourni), puis réessaie.";
  }
  return msg;
}

/**
 * Exécute une requête sur Turso depuis le navigateur (client libSQL web, HTTP).
 * Chargé à la demande pour ne pas alourdir le bundle. Retourne les lignes.
 */
async function tursoRows(
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

/**
 * Exécute une écriture Turso (UPDATE/INSERT/DELETE) et renvoie le nombre de
 * lignes affectées. Sert à distinguer un vrai succès d'un « 0 ligne » (jeton en
 * lecture seule, id introuvable) — un jeton en lecture seule fait de toute façon
 * lever `execute`, capté par l'appelant.
 */
async function tursoExec(url: string, token: string, sql: string, args: unknown[] = []): Promise<number> {
  const { createClient } = await import("@libsql/client/web");
  const client = createClient({
    url: url.trim().replace(/^libsql:\/\//i, "https://"),
    authToken: token.trim(),
  });
  const res = await client.execute({ sql, args: args as never[] });
  return res.rowsAffected ?? 0;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Compte d'offres par source, lu EN DIRECT dans Turso (une requête groupée). */
async function tursoCounts(url: string, token: string): Promise<Record<string, number>> {
  const rows = await tursoRows(url, token, "SELECT sourceId, COUNT(*) AS n FROM Job GROUP BY sourceId");
  const m: Record<string, number> = {};
  for (const r of rows) m[String(r.sourceId)] = Number(r.n);
  return m;
}

/** Interprète une date SQLite (chaîne ISO OU nombre en s/ms) en ms epoch. */
function whenMs(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v > 1e12 ? v : v * 1000;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n > 1e12 ? n : n * 1000;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function parseJsonArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function numOpt(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function strOpt(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function jobToOfferRow(j: Job): OfferRow {
  return {
    id: j.id,
    title: j.title,
    company: j.company,
    url: j.url,
    location: j.location,
    city: j.city,
    regionId: j.regionId,
    remote: j.remote,
    categoryId: j.categoryId,
    employmentType: j.employmentType,
    salaryMin: j.salaryMin,
    salaryMax: j.salaryMax,
    salaryPeriod: j.salaryPeriod,
    currency: j.currency,
    description: j.description,
    tags: j.tags ?? [],
    languages: [...(j.languages ?? [])],
    postedAt: whenMs(j.postedAt ?? null),
    companyLogoUrl: j.companyLogoUrl,
  };
}

function tursoToOfferRow(r: Record<string, unknown>): OfferRow {
  return {
    id: String(r.id ?? ""),
    title: String(r.title ?? ""),
    company: String(r.company ?? ""),
    url: String(r.url ?? ""),
    location: strOpt(r.location),
    city: strOpt(r.city),
    regionId: strOpt(r.regionId),
    remote: strOpt(r.remote),
    categoryId: strOpt(r.categoryId),
    employmentType: strOpt(r.employmentType),
    salaryMin: numOpt(r.salaryMin),
    salaryMax: numOpt(r.salaryMax),
    salaryPeriod: strOpt(r.salaryPeriod),
    currency: strOpt(r.currency),
    description: strOpt(r.description),
    tags: parseJsonArray(r.tags),
    languages: parseJsonArray(r.languages),
    postedAt: whenMs(r.postedAt),
    companyLogoUrl: strOpt(r.companyLogoUrl),
  };
}

/** Temps relatif court en français : « il y a 2 h », « il y a 3 j »… */
function relTime(ms: number | null): string {
  if (ms == null) return "";
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d} j`;
  return `il y a ${Math.floor(d / 30)} mois`;
}

/** Ligne SQL Employer → objet Employer de l'UI. */
function rowToEmployer(r: Record<string, unknown>): Employer {
  let sectors: string[] = [];
  try {
    sectors = JSON.parse((r.sectors as string) || "[]");
  } catch {
    /* ignore */
  }
  return {
    id: String(r.id),
    name: String(r.name),
    homepage: String(r.homepage),
    careersUrl: String(r.careersUrl),
    method: r.method as DiscoveredMethod,
    region: r.region ? String(r.region) : undefined,
    rbq: r.rbq ? String(r.rbq) : undefined,
    scope: r.scope ? String(r.scope) : undefined,
    sectors,
    verified: Number(r.verified) === 1,
    enabled: Number(r.enabled) !== 0,
  };
}

/** Détecte owner/repo depuis l'URL GitHub Pages (repli sur des constantes). */
function ghRepo(): { owner: string; repo: string } {
  try {
    const host = location.hostname.split(".")[0];
    const seg = location.pathname.split("/").filter(Boolean)[0];
    if (location.hostname.endsWith("github.io") && host && seg) return { owner: host, repo: seg };
  } catch {
    /* SSR / build */
  }
  return { owner: "CR4SH3UR", repo: "JobCCQ" };
}

const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

/** Encode en base64 sûr pour l'UTF-8 (accents). */
function b64utf8(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

/** Récupère le discovered.json le plus récent committé (sans jeton). */
async function fetchLatestDiscovered(): Promise<Employer[] | null> {
  const { owner, repo } = ghRepo();
  try {
    const r = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/main/${DISCOVERED_PATH}?t=${Date.now()}`,
      { cache: "no-store" },
    );
    if (!r.ok) return null;
    return (await r.json()) as Employer[];
  } catch {
    return null;
  }
}

/** Signature légère (compte + hash des champs éditables) pour détecter un écart. */
function sigOf(list: { id: string; careersUrl: string; method: string; verified?: boolean; enabled?: boolean }[]): string {
  let h = 0;
  for (const e of list) {
    const s = `${e.id}|${e.careersUrl}|${e.method}|${e.verified ? 1 : 0}|${e.enabled === false ? 0 : 1}`;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return `${list.length}:${h >>> 0}`;
}

function loadLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible */
  }
}

export function AdminExplorer() {
  const [mode, setMode] = useState<Mode>("loading");
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(1);
  const [scrapes, setScrapes] = useState<Record<string, ScrapeState>>({});
  const [publish, setPublish] = useState<{ status: "idle" | "run" | "ok" | "err"; message?: string }>({ status: "idle" });
  const [scrapeAll, setScrapeAll] = useState<{ status: "idle" | "run" | "ok" | "err"; message?: string }>({ status: "idle" });
  const [ghToken, setGhToken] = useState("");
  const [ghOpen, setGhOpen] = useState(false);
  const [tursoUrl, setTursoUrl] = useState("");
  const [tursoToken, setTursoToken] = useState("");
  // Coffre-fort chiffré (synchro des identifiants dans le compte).
  const { user: authUser, enabled: authEnabled } = useAuth();
  const [passphrase, setPassphrase] = useState("");
  const [vault, setVault] = useState<{ busy: "idle" | "save" | "load"; msg?: string; tone?: "ok" | "err" }>({
    busy: "idle",
  });
  const [stale, setStale] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [sort, setSort] = useState<SortKey>("name");
  const [methodFilter, setMethodFilter] = useState<"all" | DiscoveredMethod>("all");
  const [regionFilter, setRegionFilter] = useState<"all" | string>("all");
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE);
  const [openOffers, setOpenOffers] = useState<Set<string>>(new Set());
  const [offersData, setOffersData] = useState<Record<string, OffersState>>({});
  const [activity, setActivity] = useState<{ loading: boolean; rows: ActivityRow[]; error?: string }>({ loading: false, rows: [] });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<{ id: string; name: string; careersUrl: string; homepage: string; method: DiscoveredMethod; region: string }>(
    { id: "", name: "", careersUrl: "", homepage: "", method: "html", region: "" },
  );
  const [bulkMsg, setBulkMsg] = useState("");
  const [lastRuns, setLastRuns] = useState<Record<string, LastRun>>({});
  // État d'enregistrement par employeur : retour visuel « en cours / enregistré /
  // échec » pour que l'admin sache si une modif a VRAIMENT été persistée (une
  // écriture Turso qui échoue n'est plus avalée silencieusement).
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const latestRef = useRef<Employer[] | null>(null);
  // Journal d'audit (#45) : « qui » = compte connecté ; les actions sont loguées
  // au fil des handlers. #46 : publication en 2 temps (aperçu du diff → confirmer).
  const auditLog = useAuditLog();
  const [auditOpen, setAuditOpen] = useState(false);
  const [pendingPublish, setPendingPublish] = useState<{ merged: Employer[]; diff: DiscoveredDiff } | null>(null);
  useEffect(() => {
    setAuditActor(authUser?.email ?? undefined);
  }, [authUser?.email]);
  // Miroir de `openOffers` : la boucle de polling (closure longue durée) l'utilise
  // pour savoir quels panneaux « Offres » sont ouverts et les rafraîchir en direct.
  const openOffersRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    openOffersRef.current = openOffers;
  }, [openOffers]);

  useEffect(() => {
    try {
      setGhToken(localStorage.getItem(LS_TOKEN) ?? "");
      setTursoUrl(localStorage.getItem(LS_TURSO_URL) ?? "");
      setTursoToken(localStorage.getItem(LS_TURSO_TOKEN) ?? "");
      // Restaure les filtres du dernier passage (recherche + sélecteurs + tri).
      setSearch(localStorage.getItem(LS_SEARCH) ?? "");
      const f = localStorage.getItem(LS_FILTER);
      if (f && (FILTER_KEYS as readonly string[]).includes(f)) setFilter(f as FilterKey);
      const srt = localStorage.getItem(LS_SORT);
      if (srt && (SORT_KEYS as readonly string[]).includes(srt)) setSort(srt as SortKey);
      const mth = localStorage.getItem(LS_METHOD);
      if (mth) setMethodFilter(mth as "all" | DiscoveredMethod);
      const rgn = localStorage.getItem(LS_REGION);
      if (rgn) setRegionFilter(rgn);
      const ps = Number(localStorage.getItem(LS_PAGESIZE));
      if (ps && ps >= 40) setPageSize(ps);
    } catch {
      /* stockage indisponible */
    }
  }, []);

  const saveTurso = (url: string, token: string) => {
    setTursoUrl(url);
    setTursoToken(token);
    try {
      url ? localStorage.setItem(LS_TURSO_URL, url) : localStorage.removeItem(LS_TURSO_URL);
      token ? localStorage.setItem(LS_TURSO_TOKEN, token) : localStorage.removeItem(LS_TURSO_TOKEN);
    } catch {
      /* stockage indisponible */
    }
  };

  const saveToken = (t: string) => {
    setGhToken(t);
    try {
      if (t) localStorage.setItem(LS_TOKEN, t);
      else localStorage.removeItem(LS_TOKEN);
    } catch {
      /* stockage indisponible */
    }
  };

  // --- Coffre-fort chiffré : synchro des identifiants dans le compte ---------
  const vaultSave = async () => {
    if (!authUser) return;
    if (passphrase.length < 8) {
      setVault({ busy: "idle", msg: "Choisis une phrase secrète d'au moins 8 caractères.", tone: "err" });
      return;
    }
    if (!ghToken && !tursoUrl && !tursoToken) {
      setVault({ busy: "idle", msg: "Aucun identifiant à sauvegarder pour l'instant.", tone: "err" });
      return;
    }
    setVault({ busy: "save" });
    try {
      const blob = await encryptJson({ ghToken, tursoUrl, tursoToken } satisfies AdminSecrets, passphrase);
      const { error } = await saveVault(authUser.id, blob);
      if (error) throw new Error(error);
      setVault({ busy: "idle", msg: "🔒 Identifiants chiffrés et enregistrés dans ton compte.", tone: "ok" });
    } catch (e) {
      setVault({ busy: "idle", msg: hintVaultError((e as Error).message), tone: "err" });
    }
  };

  const vaultRestore = async () => {
    if (!authUser) return;
    if (!passphrase) {
      setVault({ busy: "idle", msg: "Entre ta phrase secrète pour déchiffrer.", tone: "err" });
      return;
    }
    setVault({ busy: "load" });
    try {
      const { ciphertext, error } = await loadVault(authUser.id);
      if (error) throw new Error(error);
      if (!ciphertext) {
        setVault({ busy: "idle", msg: "Aucun coffre enregistré dans ce compte.", tone: "err" });
        return;
      }
      const secrets = await decryptJson<AdminSecrets>(ciphertext, passphrase);
      if (secrets.ghToken !== undefined) saveToken(secrets.ghToken);
      if (secrets.tursoUrl !== undefined || secrets.tursoToken !== undefined) {
        saveTurso(secrets.tursoUrl ?? "", secrets.tursoToken ?? "");
      }
      setVault({ busy: "idle", msg: "✅ Identifiants restaurés. Rechargement…", tone: "ok" });
      setTimeout(() => location.reload(), 900);
    } catch (e) {
      const err = e as Error;
      const wrong = err.name === "OperationError" || /operation-specific|decrypt/i.test(err.message);
      setVault({
        busy: "idle",
        msg: wrong ? "Phrase secrète incorrecte." : hintVaultError(err.message),
        tone: "err",
      });
    }
  };

  const vaultForget = async () => {
    if (!authUser) return;
    if (!window.confirm("Supprimer le coffre chiffré de ton compte ?\n\n(Les identifiants restent dans ce navigateur.)"))
      return;
    const { error } = await clearVault(authUser.id);
    setVault({
      busy: "idle",
      msg: error ? hintVaultError(error) : "Coffre supprimé du compte.",
      tone: error ? "err" : "ok",
    });
  };

  // Filtres persistés : on écrit dans localStorage à chaque changement pour que
  // la recherche et le sélecteur restent identiques après un rafraîchissement.
  const changeSearch = (v: string) => {
    setSearch(v);
    try {
      v ? localStorage.setItem(LS_SEARCH, v) : localStorage.removeItem(LS_SEARCH);
    } catch {
      /* stockage indisponible */
    }
  };
  const changeFilter = (v: FilterKey) => {
    setFilter(v);
    try {
      localStorage.setItem(LS_FILTER, v);
    } catch {
      /* stockage indisponible */
    }
  };
  const changeSort = (v: SortKey) => {
    setSort(v);
    try {
      localStorage.setItem(LS_SORT, v);
    } catch {
      /* stockage indisponible */
    }
  };
  const changeMethodFilter = (v: "all" | DiscoveredMethod) => {
    setMethodFilter(v);
    try {
      localStorage.setItem(LS_METHOD, v);
    } catch {
      /* stockage indisponible */
    }
  };
  const changeRegionFilter = (v: string) => {
    setRegionFilter(v);
    try {
      v && v !== "all" ? localStorage.setItem(LS_REGION, v) : localStorage.removeItem(LS_REGION);
    } catch {
      /* stockage indisponible */
    }
  };
  const changePageSize = (v: number) => {
    setPageSize(v);
    try {
      localStorage.setItem(LS_PAGESIZE, String(v));
    } catch {
      /* stockage indisponible */
    }
  };

  // Édition locale (mode statique) : superposée aux données du paquet partagé.
  const editsRef = useRef<Record<string, Partial<Employer>>>({});

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    adminFetch(`${API_URL}/admin/employers`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { employers: Employer[] }) => {
        if (!alive) return;
        clearTimeout(t);
        setEmployers(d.employers);
        setMode("api");
      })
      .catch(async () => {
        if (!alive) return;
        clearTimeout(t);
        // Mode Turso : base partagée, lue directement depuis le navigateur
        // (prioritaire sur le mode statique quand un jeton Turso est configuré).
        const tUrl = readLS(LS_TURSO_URL);
        const tTok = readLS(LS_TURSO_TOKEN);
        if (tUrl && tTok) {
          try {
            const rows = await tursoRows(
              tUrl,
              tTok,
              "SELECT id,name,homepage,careersUrl,method,region,rbq,scope,sectors,verified,enabled FROM Employer ORDER BY name",
            );
            if (!alive) return;
            setEmployers(rows.map(rowToEmployer));
            setMode("turso");
            return;
          } catch {
            /* échec Turso (jeton/URL) → repli sur le mode statique */
          }
        }
        // Mode statique : données du paquet + éditions/vérifs locales.
        editsRef.current = loadLS<Record<string, Partial<Employer>>>(LS_EDITS, {});
        const verified = new Set(loadLS<string[]>(LS_VERIF, []));
        const base = (DISCOVERED_EMPLOYERS as unknown as Employer[]).map((e) => ({
          ...e,
          ...editsRef.current[e.id],
          verified: e.verified || verified.has(e.id) || !!editsRef.current[e.id]?.verified,
        }));
        setEmployers(base);
        setMode("static");
        // Détecte si une version plus récente est committée (bundle périmé).
        fetchLatestDiscovered().then((latest) => {
          if (!alive || !latest) return;
          if (sigOf(latest) !== sigOf(DISCOVERED_EMPLOYERS as unknown as Employer[])) {
            latestRef.current = latest;
            setStale(true);
          }
        });
      });
    return () => {
      alive = false;
    };
  }, []);

  // Compteurs d'offres par source. En mode Turso on les lit EN DIRECT dans la
  // base ; sinon ils viennent de l'instantané statique jobs.json (figé jusqu'au
  // redéploiement — d'où un badge périmé après un re-scrape en mode Turso).
  const refreshCounts = async () => {
    const tUrl = tursoUrl || readLS(LS_TURSO_URL);
    const tTok = tursoToken || readLS(LS_TURSO_TOKEN);
    if (mode === "turso" && tUrl && tTok) {
      const m = await tursoCounts(tUrl, tTok).catch(() => null);
      if (m) setCounts(m);
      return;
    }
    const s = await getStats().catch(() => null);
    if (s) {
      const m: Record<string, number> = {};
      for (const x of s.bySource) m[x.id] = x.count;
      setCounts(m);
    }
  };

  // Dernier scrape connu par employeur (mode Turso). Une seule requête : SQLite
  // renvoie les colonnes de la ligne au MAX(id) → l'exécution la plus récente
  // par source (statut, date, nb trouvé, erreur éventuelle).
  const refreshLastRuns = async () => {
    const tUrl = tursoUrl || readLS(LS_TURSO_URL);
    const tTok = tursoToken || readLS(LS_TURSO_TOKEN);
    if (mode !== "turso" || !tUrl || !tTok) return;
    const rows = await tursoRows(
      tUrl,
      tTok,
      "SELECT sourceId, status, found, error, finishedAt, startedAt, MAX(id) AS id FROM ScrapeRun GROUP BY sourceId",
    ).catch(() => null);
    if (!rows) return;
    const m: Record<string, LastRun> = {};
    for (const r of rows) {
      m[String(r.sourceId)] = {
        status: String(r.status ?? ""),
        at: whenMs(r.finishedAt ?? r.startedAt),
        found: Number(r.found ?? 0),
        error: r.error ? String(r.error) : undefined,
      };
    }
    setLastRuns(m);
  };

  // Flux d'activité : les 30 dernières exécutions de scraping, toutes sources
  // confondues (mode Turso). Vue chronologique complémentaire de la pastille
  // « dernier scrape » par ligne. Chargé à l'ouverture du panneau.
  const loadActivity = async () => {
    const tUrl = tursoUrl || readLS(LS_TURSO_URL);
    const tTok = tursoToken || readLS(LS_TURSO_TOKEN);
    if (mode !== "turso" || !tUrl || !tTok) return;
    setActivity((a) => ({ ...a, loading: true, error: undefined }));
    try {
      const raw = await tursoRows(
        tUrl,
        tTok,
        "SELECT id, sourceId, status, found, inserted, updated, error, finishedAt, startedAt FROM ScrapeRun ORDER BY id DESC LIMIT 30",
      );
      const rows: ActivityRow[] = raw.map((r) => ({
        id: Number(r.id),
        sourceId: String(r.sourceId),
        status: String(r.status ?? ""),
        found: Number(r.found ?? 0),
        inserted: Number(r.inserted ?? 0),
        updated: Number(r.updated ?? 0),
        error: r.error ? String(r.error) : undefined,
        at: whenMs(r.finishedAt ?? r.startedAt),
      }));
      setActivity({ loading: false, rows });
    } catch (err) {
      setActivity({ loading: false, rows: [], error: (err as Error).message });
    }
  };

  // Aperçu déroulant des offres d'un employeur (titres + villes + liens). En
  // mode Turso on lit EN DIRECT la table Job ; sinon via la couche de données
  // (API locale ou instantané statique). Résultat mis en cache par employeur.
  // Charge (TOUJOURS, en ignorant le cache) l'aperçu des offres d'un employeur
  // depuis la source de vérité : Turso en direct, sinon la couche de données
  // (API locale ou instantané statique). Sert à l'ouverture du panneau ET après
  // un (re)scrape pour que la liste déroulée reflète l'état réel de la base sans
  // recharger la page. On garde les lignes précédentes visibles pendant le
  // rechargement (spinner discret) plutôt que de vider l'affichage.
  const loadOffers = async (id: string) => {
    setOffersData((d) => ({ ...d, [id]: { loading: true, rows: d[id]?.rows ?? [] } }));
    try {
      let rows: OfferRow[] = [];
      if (mode === "turso") {
        const tUrl = tursoUrl || readLS(LS_TURSO_URL);
        const tTok = tursoToken || readLS(LS_TURSO_TOKEN);
        const raw = await tursoRows(tUrl, tTok, OFFERS_SQL, [id]);
        rows = raw.map(tursoToOfferRow);
      } else {
        const res = await searchJobs(buildQuery({ sources: [id], pageSize: 60, sort: "recent" }));
        rows = res.items.map(jobToOfferRow);
      }
      setOffersData((d) => ({ ...d, [id]: { loading: false, rows } }));
    } catch (err) {
      setOffersData((d) => ({ ...d, [id]: { loading: false, rows: [], error: (err as Error).message } }));
    }
  };

  const toggleOffers = async (id: string) => {
    const willOpen = !openOffers.has(id);
    setOpenOffers((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    if (!willOpen) return; // on referme : rien à charger
    if (offersData[id] && !offersData[id].error) return; // déjà en cache
    await loadOffers(id);
  };

  // Après un changement de données pour une source (re-scrape, purge) : si son
  // panneau « Offres » est ouvert, on recharge la liste en direct ; sinon on
  // invalide le cache pour que la prochaine ouverture reparte de la base. C'est
  // ce qui évite d'avoir à rafraîchir la page pour voir les offres remplacées.
  const refreshOffersIfLoaded = (id: string) => {
    if (openOffersRef.current.has(id)) {
      void loadOffers(id);
    } else {
      setOffersData((d) => {
        if (!(id in d)) return d;
        const n = { ...d };
        delete n[id];
        return n;
      });
    }
  };

  // (Re)charge les compteurs + le dernier scrape dès que le mode est connu
  // (Turso → base ; sinon instantané). Rejoué si le mode change.
  useEffect(() => {
    if (mode !== "loading") {
      refreshCounts();
      refreshLastRuns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const reloadData = async () => {
    setReloading(true);
    try {
      if (mode === "turso") {
        const rows = await tursoRows(
          tursoUrl,
          tursoToken,
          "SELECT id,name,homepage,careersUrl,method,region,rbq,scope,sectors,verified,enabled FROM Employer ORDER BY name",
        ).catch(() => null);
        if (rows) setEmployers(rows.map(rowToEmployer));
      } else if (mode === "api") {
        const d = await adminFetch(`${API_URL}/admin/employers`).then((r) => r.json()).catch(() => null);
        if (d?.employers) setEmployers(d.employers);
      } else {
        const latest = latestRef.current ?? (await fetchLatestDiscovered());
        if (latest) {
          editsRef.current = loadLS<Record<string, Partial<Employer>>>(LS_EDITS, {});
          const verified = new Set(loadLS<string[]>(LS_VERIF, []));
          setEmployers(
            latest.map((e) => ({
              ...e,
              ...editsRef.current[e.id],
              verified: e.verified || verified.has(e.id) || !!editsRef.current[e.id]?.verified,
            })),
          );
        }
      }
      await refreshCounts();
      await refreshLastRuns();
      latestRef.current = null;
      setStale(false);
    } finally {
      setReloading(false);
    }
  };

  // Efface l'indicateur d'enregistrement d'un employeur après un délai.
  const clearSaveLater = (id: string, ms = 2500) => {
    setTimeout(() => setSaveState((s) => {
      const n = { ...s };
      delete n[id];
      return n;
    }), ms);
  };

  const patchEmployer = async (id: string, patch: Partial<Employer>) => {
    // Valeurs précédentes des champs touchés → permet d'annuler l'affichage si
    // l'écriture échoue (sinon la modif « optimiste » laisse croire à un succès).
    const prev = employers.find((e) => e.id === id);
    const before: Record<string, unknown> = {};
    for (const k of Object.keys(patch)) before[k] = (prev as Record<string, unknown> | undefined)?.[k];
    const revert = () =>
      setEmployers((list) => list.map((e) => (e.id === id ? ({ ...e, ...before } as Employer) : e)));

    // Résumé des champs modifiés pour le journal d'audit (#45).
    const targetName = prev?.name ?? id;
    const fieldSummary = Object.keys(patch)
      .map((k) => {
        const v = (patch as Record<string, unknown>)[k];
        return `${k} = ${Array.isArray(v) ? `[${v.length}]` : String(v)}`;
      })
      .join(", ");
    const logEdit = () => logAudit("edit", { targetId: id, targetName, detail: fieldSummary });

    // Mise à jour optimiste immédiate (réactivité).
    setEmployers((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));

    if (mode === "api") {
      setSaveState((s) => ({ ...s, [id]: { s: "saving" } }));
      try {
        const res = await adminFetch(`${API_URL}/admin/employers/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSaveState((s) => ({ ...s, [id]: { s: "ok" } }));
        logEdit();
        clearSaveLater(id);
      } catch (err) {
        revert();
        setSaveState((s) => ({ ...s, [id]: { s: "err", msg: (err as Error).message } }));
      }
      return;
    }

    if (mode === "turso") {
      // Écriture directe dans la table Employer (base partagée), en direct.
      const cols: string[] = [];
      const args: unknown[] = [];
      for (const k of ["name", "careersUrl", "method", "homepage", "region", "scope", "rbq"] as const) {
        if (k in patch) {
          cols.push(`${k}=?`);
          args.push((patch as Record<string, unknown>)[k]);
        }
      }
      if ("sectors" in patch) {
        // Colonne stockée en JSON dans Turso.
        cols.push("sectors=?");
        args.push(JSON.stringify(patch.sectors ?? []));
      }
      if ("verified" in patch) {
        cols.push("verified=?");
        args.push(patch.verified ? 1 : 0);
      }
      if ("enabled" in patch) {
        cols.push("enabled=?");
        args.push(patch.enabled === false ? 0 : 1);
      }
      if (!cols.length) return; // rien de persistable dans ce patch
      cols.push("updatedAt=?");
      args.push(new Date().toISOString());
      args.push(id);
      setSaveState((s) => ({ ...s, [id]: { s: "saving" } }));
      try {
        // libSQL renvoie le nombre de lignes modifiées : 0 = rien écrit (jeton en
        // lecture seule, id introuvable…) → on le signale au lieu de faire croire
        // à un succès. Un jeton en lecture seule fait de toute façon lever l'appel.
        const affected = await tursoExec(
          tursoUrl,
          tursoToken,
          `UPDATE Employer SET ${cols.join(",")} WHERE id=?`,
          args,
        );
        if (affected === 0) throw new Error("0 ligne modifiée (jeton en lecture seule ou id introuvable ?)");
        setSaveState((s) => ({ ...s, [id]: { s: "ok" } }));
        logEdit();
        clearSaveLater(id);
      } catch (err) {
        revert();
        setSaveState((s) => ({ ...s, [id]: { s: "err", msg: (err as Error).message } }));
      }
      return;
    }

    // Mode lecture/statique : pas de base joignable → édition LOCALE seulement
    // (ce navigateur), jamais publiée. On le signale clairement.
    editsRef.current[id] = { ...editsRef.current[id], ...patch };
    saveLS(LS_EDITS, editsRef.current);
    const verified = new Set(loadLS<string[]>(LS_VERIF, []));
    if ("verified" in patch) {
      patch.verified ? verified.add(id) : verified.delete(id);
      saveLS(LS_VERIF, [...verified]);
    }
    setSaveState((s) => ({ ...s, [id]: { s: "local" } }));
    logEdit();
    clearSaveLater(id, 4000);
  };

  const rescrape = async (id: string) => {
    if (mode !== "api") return;
    setScrapes((s) => ({ ...s, [id]: { status: "run" } }));
    try {
      const r = await adminFetch(`${API_URL}/admin/employers/${id}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPages: 2 }),
      });
      const d = await r.json();
      if (d.report?.status === "success") {
        setScrapes((s) => ({ ...s, [id]: { status: "ok", found: d.report.found, sample: d.sample } }));
        logAudit("scrape", { targetId: id, targetName: employers.find((e) => e.id === id)?.name ?? id, detail: `${d.report.found} offre(s)` });
        // Le scrape a écrit en base : on rafraîchit le compteur ET l'aperçu
        // déroulé « Offres » (si ouvert) sans recharger la page.
        refreshCounts();
        refreshOffersIfLoaded(id);
      } else {
        setScrapes((s) => ({ ...s, [id]: { status: "err", error: d.report?.error ?? "échec" } }));
      }
    } catch (e) {
      setScrapes((s) => ({ ...s, [id]: { status: "err", error: (e as Error).message } }));
    }
  };

  // Supprime TOUTES les offres d'un employeur (remise à zéro avant re-scrape).
  // Turso : DELETE direct en base ; API locale : endpoint dédié. Confirmation
  // obligatoire (destructif).
  const purgeOffers = async (id: string) => {
    if (mode !== "api" && mode !== "turso") return;
    const name = employers.find((e) => e.id === id)?.name ?? id;
    const n = counts[id] ?? 0;
    if (
      !window.confirm(
        `Supprimer les ${n} offre${n > 1 ? "s" : ""} de « ${name} » ?\n\n` +
          `Action irréversible. (Elles reviendront au prochain scrape si le site en publie.)`,
      )
    )
      return;
    if (mode === "turso") {
      await tursoRows(tursoUrl, tursoToken, "DELETE FROM Job WHERE sourceId=?", [id]).catch(() => {});
    } else {
      await adminFetch(`${API_URL}/admin/employers/${id}/offers`, { method: "DELETE" }).catch(() => {});
    }
    setCounts((c) => ({ ...c, [id]: 0 }));
    logAudit("purge", { targetId: id, targetName: name, detail: `${n} offre(s) supprimée(s)` });
    // Vide aussi l'aperçu déroulé « Offres » (sinon il montre encore les
    // anciennes offres jusqu'au prochain rafraîchissement de la page).
    setOffersData((d) => (id in d ? { ...d, [id]: { loading: false, rows: [] } } : d));
  };

  const publishChanges = async () => {
    setPublish({ status: "run" });
    try {
      const r = await adminFetch(`${API_URL}/admin/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await r.json();
      logAudit("publish", { detail: "API — publication de l'instantané" });
      setPublish({ status: d.published || d.message ? "ok" : "err", message: d.message || d.error || "Terminé." });
    } catch (e) {
      setPublish({ status: "err", message: (e as Error).message });
    }
  };

  const cleanList = () =>
    employers.map((e) => ({
      id: e.id, name: e.name, homepage: e.homepage, careersUrl: e.careersUrl,
      method: e.method, region: e.region, rbq: e.rbq, scope: e.scope, sectors: e.sectors,
      ...(e.verified ? { verified: true } : {}),
      ...(e.enabled === false ? { enabled: false } : {}),
    }));

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(cleanList(), null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "discovered.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Suivi des re-scrapes en cours : UNE seule boucle de polling pour TOUTES les
  // sources en attente (file `pendingRef`). On détecte la fin d'un scrape via la
  // table **ScrapeRun** (une ligne par exécution, passant de « running » à
  // « success »/« error »), et NON via un changement du nombre d'offres : un
  // re-scrape qui retrouve le MÊME nombre d'offres est un cas fréquent, et
  // l'ancienne détection « le compte a changé » le ratait (« marche 1 fois sur
  // 2 »). Une seule requête ScrapeRun par tick → insensible au nombre de
  // re-scrapes simultanés. Chaque source quitte la file à la fin de son scrape,
  // ou après ~3 min (garde-fou si l'exécution meurt sans se clôturer).
  const pendingRef = useRef<Map<string, { deadline: number }>>(new Map());
  const pollingRef = useRef(false);

  const runPollLoop = async () => {
    if (pollingRef.current) return; // une seule boucle à la fois
    const tUrl = tursoUrl || readLS(LS_TURSO_URL);
    const tTok = tursoToken || readLS(LS_TURSO_TOKEN);
    if (!tUrl || !tTok) {
      pendingRef.current.clear();
      return;
    }
    pollingRef.current = true;
    try {
      // Repère de départ : seules les exécutions créées APRÈS ce point comptent
      // (id auto-incrémenté → monotone, insensible à l'horloge du navigateur).
      const base = await tursoRows(tUrl, tTok, "SELECT COALESCE(MAX(id),0) AS m FROM ScrapeRun").catch(() => null);
      const sinceId = base ? Number(base[0]?.m ?? 0) : 0;
      while (pendingRef.current.size > 0) {
        await sleep(6000);
        // Exécutions TERMINÉES depuis le repère (toutes sources ; on filtre les
        // suivies côté client). Peu de lignes : seulement les scrapes récents.
        const runs = await tursoRows(
          tUrl,
          tTok,
          "SELECT sourceId, status, found, error, id FROM ScrapeRun WHERE id > ? AND status != 'running' ORDER BY id ASC",
          [sinceId],
        ).catch(() => null);
        if (runs) {
          for (const r of runs) {
            const id = String(r.sourceId);
            if (!pendingRef.current.has(id)) continue;
            // Compte RÉEL en base (peut différer de `found` après purge/dédup).
            const cnt = await tursoRows(tUrl, tTok, "SELECT COUNT(*) AS n FROM Job WHERE sourceId=?", [id]).catch(
              () => null,
            );
            const n = cnt ? Number(cnt[0]?.n ?? 0) : Number(r.found ?? 0);
            setCounts((c) => ({ ...c, [id]: n }));
            setLastRuns((prev) => ({
              ...prev,
              [id]: {
                status: String(r.status ?? ""),
                at: Date.now(),
                found: Number(r.found ?? 0),
                error: r.status === "error" ? String(r.error ?? "") : undefined,
              },
            }));
            setScrapes((s) => ({
              ...s,
              [id]:
                r.status === "error"
                  ? { status: "err", error: String(r.error ?? "échec du scrape") }
                  : { status: "ok", found: n, error: "updated" },
            }));
            // Rafraîchit l'aperçu déroulé « Offres » de cette source SANS
            // recharger la page : rechargement en direct si le panneau est
            // ouvert, sinon invalidation du cache pour la prochaine ouverture.
            if (r.status !== "error") {
              if (openOffersRef.current.has(id)) {
                const offerRows = await tursoRows(tUrl, tTok, OFFERS_SQL, [id]).catch(() => null);
                if (offerRows) {
                  setOffersData((d) => ({ ...d, [id]: { loading: false, rows: offerRows.map(tursoToOfferRow) } }));
                }
              } else {
                setOffersData((d) => {
                  if (!(id in d)) return d;
                  const nn = { ...d };
                  delete nn[id];
                  return nn;
                });
              }
            }
            pendingRef.current.delete(id);
          }
        }
        // Garde-fou : sources dont la fenêtre est écoulée (exécution morte/lente).
        // On ne laisse PAS la ligne bloquée sur « Scraping… » : on arrête le
        // spinner et on invite à rafraîchir (le scrape a pu aboutir en base
        // après la fenêtre — fréquent pour Jobillico, plus lent via le proxy).
        for (const [id, info] of [...pendingRef.current]) {
          if (Date.now() > info.deadline) {
            pendingRef.current.delete(id);
            setScrapes((s) => ({ ...s, [id]: { status: "ok", error: "timeout" } }));
          }
        }
      }
    } finally {
      pollingRef.current = false;
      // Resynchronise les compteurs depuis la base (source de vérité), même si
      // un poll a expiré : le badge d'offres reflète alors l'état réel.
      void refreshCounts();
    }
  };

  // Ajoute une source re-scrapée à la file suivie et (re)lance la boucle unique.
  // Fenêtre large : un scrape Jobillico (proxy + fiches détaillées) + la file
  // d'attente du workflow GitHub peut dépasser 3 min avant d'apparaître en base.
  const queuePoll = (sourceId: string) => {
    pendingRef.current.set(sourceId, { deadline: Date.now() + 360_000 });
    void runPollLoop();
  };

  // --- Mode statique : agir sur GitHub via le jeton personnel du navigateur ---
  // `opts.force` outrepasse le garde-fou anti-purge (remplace les offres même si
  // le site en renvoie moins/zéro) — pour un employeur mal configuré.
  const ghScrape = async (sourceId: string, opts?: { force?: boolean; maxPages?: number }) => {
    const { owner, repo } = ghRepo();
    setScrapes((s) => ({ ...s, [sourceId]: { status: "run" } }));
    try {
      const inputs: Record<string, string> = { sourceId, maxPages: String(opts?.maxPages ?? 2) };
      if (opts?.force) inputs.force = sourceId;
      const r = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/scrape.yml/dispatches`,
        { method: "POST", headers: GH_HEADERS(ghToken), body: JSON.stringify({ ref: "main", inputs }) },
      );
      if (r.status === 204) {
        setScrapes((s) => ({ ...s, [sourceId]: { status: "ok", error: "launched" } }));
        logAudit(opts?.force ? "scrape-force" : "scrape", {
          targetId: sourceId,
          targetName: employers.find((e) => e.id === sourceId)?.name ?? sourceId,
          detail: opts?.force ? "re-scrape forcé lancé (GitHub)" : "re-scrape lancé (GitHub)",
        });
        // Mode Turso : suit la base et rafraîchit le compteur automatiquement.
        if (mode === "turso") queuePoll(sourceId);
      } else {
        const d = await r.json().catch(() => ({}));
        setScrapes((s) => ({ ...s, [sourceId]: { status: "err", error: d.message ?? `HTTP ${r.status}` } }));
      }
    } catch (e) {
      setScrapes((s) => ({ ...s, [sourceId]: { status: "err", error: (e as Error).message } }));
    }
  };

  // Re-scrape FORCÉ d'un employeur (ignore l'anti-purge). Confirmation requise.
  const scrapeForce = (id: string) => {
    const name = employers.find((e) => e.id === id)?.name ?? id;
    if (
      !window.confirm(
        `Re-scraper « ${name} » en mode FORCÉ ?\n\n` +
          `Le garde-fou anti-purge est ignoré : les offres actuelles seront remplacées ` +
          `par ce que le site renvoie maintenant (même moins, ou zéro). ` +
          `À utiliser pour un employeur mal configuré.`,
      )
    )
      return;
    void ghScrape(id, { force: true });
  };

  // Scrape COMPLET (toutes les sources) via le workflow GitHub (sourceId vide).
  const ghScrapeAll = async () => {
    if (
      !window.confirm(
        "Lancer un scrape COMPLET de toutes les sources ?\n\n" +
          "Cela déclenche le workflow GitHub (peut durer ~1 h). Les compteurs se " +
          "mettront à jour au fil de l'eau ; suis l'avancement dans « Activité récente ».",
      )
    )
      return;
    const { owner, repo } = ghRepo();
    setScrapeAll({ status: "run" });
    try {
      const r = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/scrape.yml/dispatches`,
        { method: "POST", headers: GH_HEADERS(ghToken), body: JSON.stringify({ ref: "main", inputs: { sourceId: "", maxPages: "2" } }) },
      );
      if (r.status === 204) logAudit("scrape-all", { detail: "scrape complet lancé (toutes les sources)" });
      setScrapeAll(
        r.status === 204
          ? { status: "ok", message: "🚀 Scrape complet lancé — voir « Activité récente »." }
          : { status: "err", message: `HTTP ${r.status}` },
      );
    } catch (e) {
      setScrapeAll({ status: "err", message: (e as Error).message });
    }
  };

  // Turso : les modifications sont déjà en base ; « publier » = redéployer le
  // site (qui se reconstruit depuis Turso). Nécessite un jeton GitHub.
  const ghTriggerDeploy = async () => {
    const { owner, repo } = ghRepo();
    setPublish({ status: "run" });
    try {
      const r = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/deploy-pages.yml/dispatches`,
        { method: "POST", headers: GH_HEADERS(ghToken), body: JSON.stringify({ ref: "main" }) },
      );
      if (r.status === 204) logAudit("redeploy", { detail: "reconstruction du site (deploy-pages)" });
      setPublish(
        r.status === 204
          ? { status: "ok", message: "Reconstruction du site lancée (quelques minutes)." }
          : { status: "err", message: `HTTP ${r.status}` },
      );
    } catch (e) {
      setPublish({ status: "err", message: (e as Error).message });
    }
  };

  // Fusionne les champs éditables de l'onglet sur le fichier committé le plus
  // récent : on ne réécrit QUE name/careersUrl/method/verified/enabled, et on
  // conserve les champs dérivés committés (rbq, sectors, scope, region,
  // homepage). Ainsi, publier depuis un onglet périmé n'efface plus le n° RBQ.
  const mergeForPublish = (committed: Employer[] | null): Employer[] => {
    const mine = cleanList() as Employer[];
    if (!committed || committed.length === 0) return mine;
    const byMine = new Map(mine.map((e) => [e.id, e]));
    const committedIds = new Set(committed.map((e) => e.id));
    const merged = committed.map((base) => {
      const cur = byMine.get(base.id);
      if (!cur) return base; // employeur absent de l'onglet : inchangé
      const m: Record<string, unknown> = {
        ...base, // conserve rbq/sectors/scope/region/homepage committés
        name: cur.name,
        careersUrl: cur.careersUrl,
        method: cur.method,
      };
      if (cur.verified) m.verified = true;
      else delete m.verified;
      if (cur.enabled === false) m.enabled = false;
      else delete m.enabled;
      return m as unknown as Employer;
    });
    // Employeurs ajoutés dans l'onglet mais pas encore committés (ajout manuel).
    for (const e of mine) if (!committedIds.has(e.id)) merged.push(e);
    return merged;
  };

  // #46 — Étape 1/2 : calcule l'aperçu du diff (fichier committé → liste
  // fusionnée à publier) et le présente pour confirmation. Aucune écriture ici.
  const preparePublish = async () => {
    setPublish({ status: "run" });
    try {
      const latest = await fetchLatestDiscovered();
      const merged = mergeForPublish(latest);
      const diff = diffDiscovered(
        (latest ?? []) as unknown as DiffEmployer[],
        merged as unknown as DiffEmployer[],
      );
      if (diff.total === 0) {
        setPendingPublish(null);
        setPublish({ status: "ok", message: "Aucun changement à publier." });
        return;
      }
      setPendingPublish({ merged, diff });
      setPublish({ status: "idle" });
    } catch (e) {
      setPublish({ status: "err", message: (e as Error).message });
    }
  };

  // #46 — Étape 2/2 : écrit discovered.json sur GitHub après confirmation.
  const confirmPublish = async () => {
    if (!pendingPublish) return;
    const { merged, diff } = pendingPublish;
    const { owner, repo } = ghRepo();
    const base = `https://api.github.com/repos/${owner}/${repo}/contents/${DISCOVERED_PATH}`;
    setPublish({ status: "run" });
    try {
      const cur = await fetch(`${base}?ref=main`, { headers: GH_HEADERS(ghToken) });
      const sha = cur.ok ? (await cur.json()).sha : undefined;
      const body = {
        message: "Admin : mise à jour des employeurs (URLs / vérifications)",
        content: b64utf8(JSON.stringify(merged, null, 2) + "\n"),
        branch: "main",
        ...(sha ? { sha } : {}),
      };
      const r = await fetch(base, { method: "PUT", headers: GH_HEADERS(ghToken), body: JSON.stringify(body) });
      if (r.ok) {
        logAudit("publish", {
          detail: `discovered.json : ${diff.added.length} ajout(s), ${diff.removed.length} retrait(s), ${diff.modified.length} modif(s)`,
        });
        setPendingPublish(null);
        setPublish({ status: "ok", message: "Publié sur GitHub — le site va se redéployer." });
      } else {
        const d = await r.json().catch(() => ({}));
        setPublish({ status: "err", message: d.message ?? `HTTP ${r.status}` });
      }
    } catch (e) {
      setPublish({ status: "err", message: (e as Error).message });
    }
  };

  // Doublons : employeurs partageant soit la MÊME URL de carrières (ex. Canam),
  // soit le MÊME NOM normalisé (même entreprise saisie deux fois — ex. une fiche
  // Jobillico + une fiche site propre, ou deux graphies « … inc. »/« … Inc »).
  const dupKey = (e: Employer) => e.careersUrl.trim().replace(/\/+$/, "").toLowerCase();
  const normName = (s: string) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // accents
      .replace(/[.,'’"()]/g, " ")
      .replace(/\b(inc|ltee|ltd|ltee?|enr|senc|cie|co|corp|corporation|incorporee?)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const { dupUrls, dupNames } = useMemo(() => {
    const urls = new Map<string, number>();
    const names = new Map<string, number>();
    for (const e of employers) {
      const u = dupKey(e);
      if (u) urls.set(u, (urls.get(u) ?? 0) + 1);
      const n = normName(e.name);
      if (n) names.set(n, (names.get(n) ?? 0) + 1);
    }
    return {
      dupUrls: new Set([...urls].filter(([, n]) => n > 1).map(([u]) => u)),
      dupNames: new Set([...names].filter(([, n]) => n > 1).map(([n]) => n)),
    };
  }, [employers]);
  const isDup = (e: Employer) => dupUrls.has(dupKey(e)) || dupNames.has(normName(e.name));

  // Régions distinctes présentes (alimente le filtre par région).
  const regions = useMemo(() => {
    const s = new Set<string>();
    for (const e of employers) if (e.region) s.add(e.region);
    return [...s].sort((a, b) => a.localeCompare(b, "fr"));
  }, [employers]);
  // id → nom, pour étiqueter le flux d'activité.
  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of employers) m[e.id] = e.name;
    return m;
  }, [employers]);
  // Union des secteurs existants → suggestions du menu à cocher (édition de fiche).
  const sectorOptions = useMemo(() => {
    const s = new Set<string>();
    for (const e of employers) for (const sec of e.sectors ?? []) if (sec) s.add(sec);
    return [...s].sort((a, b) => a.localeCompare(b, "fr"));
  }, [employers]);

  // --- Sélection multiple + actions groupées -------------------------------
  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const scrapeOne = mode === "api" ? rescrape : ghScrape;
  const bulkRescrape = async (ids: string[]) => {
    setBulkMsg(`Re-scraping de ${ids.length} employeur(s) lancé…`);
    for (const id of ids) await scrapeOne(id);
  };
  const bulkSetEnabled = async (ids: string[], enabled: boolean) => {
    for (const id of ids) await patchEmployer(id, { enabled });
    setBulkMsg(`${ids.length} employeur(s) ${enabled ? "activé(s)" : "désactivé(s)"}.`);
  };
  const bulkPurge = async (ids: string[]) => {
    const withJobs = ids.filter((id) => (counts[id] ?? 0) > 0);
    if (!withJobs.length) {
      setBulkMsg("Aucune offre à vider dans la sélection.");
      return;
    }
    if (!window.confirm(`Vider les offres de ${withJobs.length} employeur(s) sélectionné(s) ?\n\nAction irréversible.`)) return;
    for (const id of withJobs) {
      if (mode === "turso") await tursoRows(tursoUrl, tursoToken, "DELETE FROM Job WHERE sourceId=?", [id]).catch(() => {});
      else await adminFetch(`${API_URL}/admin/employers/${id}/offers`, { method: "DELETE" }).catch(() => {});
    }
    setCounts((c) => {
      const n = { ...c };
      for (const id of withJobs) n[id] = 0;
      return n;
    });
    setBulkMsg(`Offres vidées pour ${withJobs.length} employeur(s).`);
  };
  const bulkSetVerified = async (ids: string[], verified: boolean) => {
    for (const id of ids) await patchEmployer(id, { verified });
    setBulkMsg(`${ids.length} employeur(s) ${verified ? "marqué(s) vérifié(s)" : "démarqué(s)"}.`);
  };
  const bulkDelete = async (ids: string[]) => {
    if (!ids.length) return;
    if (!window.confirm(`Supprimer DÉFINITIVEMENT ${ids.length} employeur(s) et TOUTES leurs offres ?\n\nAction irréversible.`)) return;
    for (const id of ids) {
      if (mode === "turso") {
        await tursoRows(tursoUrl, tursoToken, "DELETE FROM Job WHERE sourceId=?", [id]).catch(() => {});
        await tursoRows(tursoUrl, tursoToken, "DELETE FROM Employer WHERE id=?", [id]).catch(() => {});
      } else if (mode === "api") {
        await adminFetch(`${API_URL}/admin/employers/${id}`, { method: "DELETE" }).catch(() => {});
      } else {
        delete editsRef.current[id];
        saveLS(LS_EDITS, editsRef.current);
      }
    }
    const gone = new Set(ids);
    setEmployers((list) => list.filter((e) => !gone.has(e.id)));
    setSelected(new Set());
    setBulkMsg(`${ids.length} employeur(s) supprimé(s).`);
  };
  const bulkSetMethod = async (ids: string[], method: DiscoveredMethod) => {
    for (const id of ids) await patchEmployer(id, { method });
    setBulkMsg(`Méthode « ${method} » appliquée à ${ids.length} employeur(s).`);
  };
  const bulkCopyUrls = async (ids: string[]) => {
    const urls = employers
      .filter((e) => ids.includes(e.id))
      .map((e) => e.careersUrl)
      .filter(Boolean);
    if (!urls.length) {
      setBulkMsg("Aucune URL à copier dans la sélection.");
      return;
    }
    try {
      // Séparées par une espace (et non un saut de ligne) pour un collage en lot.
      await navigator.clipboard.writeText(urls.join(" "));
      setBulkMsg(`${urls.length} URL(s) copiée(s) dans le presse-papiers.`);
    } catch {
      setBulkMsg("Échec de la copie (presse-papiers non accessible).");
    }
  };

  // --- Ajout / suppression d'un employeur ----------------------------------
  const addEmployer = async () => {
    const id = form.id.trim();
    const name = form.name.trim();
    const careersUrl = form.careersUrl.trim();
    if (!id || !name || !careersUrl) {
      setBulkMsg("id, nom et URL carrières sont requis.");
      return;
    }
    if (employers.some((e) => e.id === id)) {
      setBulkMsg(`L'id « ${id} » existe déjà.`);
      return;
    }
    let homepage = form.homepage.trim();
    if (!homepage) {
      try {
        homepage = new URL(careersUrl).origin;
      } catch {
        homepage = careersUrl;
      }
    }
    const region = form.region.trim();
    const emp: Employer = { id, name, homepage, careersUrl, method: form.method, sectors: [], enabled: true, ...(region ? { region } : {}) };
    if (mode === "turso") {
      const now = new Date().toISOString();
      const ok = await tursoRows(
        tursoUrl,
        tursoToken,
        "INSERT INTO Employer (id,name,homepage,careersUrl,method,region,sectors,verified,enabled,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [id, name, homepage, careersUrl, form.method, region || null, "[]", 0, 1, now, now],
      )
        .then(() => true)
        .catch(() => false);
      if (!ok) {
        setBulkMsg("Échec de l'insertion dans Turso (id en double ?).");
        return;
      }
    } else if (mode === "api") {
      await adminFetch(`${API_URL}/admin/employers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(emp) }).catch(() => {});
    } else {
      editsRef.current[id] = emp;
      saveLS(LS_EDITS, editsRef.current);
    }
    setEmployers((list) => [...list, emp].sort((a, b) => a.name.localeCompare(b.name)));
    setForm({ id: "", name: "", careersUrl: "", homepage: "", method: "html", region: "" });
    setAddOpen(false);
    setBulkMsg(`Employeur « ${name} » ajouté.`);
  };

  const deleteEmployer = async (id: string) => {
    const name = employers.find((e) => e.id === id)?.name ?? id;
    const n = counts[id] ?? 0;
    if (!window.confirm(`Supprimer DÉFINITIVEMENT « ${name} »${n ? ` et ses ${n} offre(s)` : ""} ?\n\nAction irréversible.`)) return;
    if (mode === "turso") {
      await tursoRows(tursoUrl, tursoToken, "DELETE FROM Job WHERE sourceId=?", [id]).catch(() => {});
      await tursoRows(tursoUrl, tursoToken, "DELETE FROM Employer WHERE id=?", [id]).catch(() => {});
    } else if (mode === "api") {
      await adminFetch(`${API_URL}/admin/employers/${id}`, { method: "DELETE" }).catch(() => {});
    } else {
      delete editsRef.current[id];
      saveLS(LS_EDITS, editsRef.current);
    }
    setEmployers((list) => list.filter((e) => e.id !== id));
    setSelected((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
    logAudit("delete", { targetId: id, targetName: name, detail: n ? `${n} offre(s) supprimée(s)` : undefined });
    setBulkMsg(`Employeur « ${name} » supprimé.`);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employers.filter((e) => {
      if (filter === "verified" && !e.verified) return false;
      if (filter === "unverified" && e.verified) return false;
      if (filter === "nojobs" && (counts[e.id] ?? 0) > 0) return false;
      if (filter === "disabled" && e.enabled !== false) return false;
      if (filter === "duplicates" && !isDup(e)) return false;
      if (filter === "errors" && lastRuns[e.id]?.status !== "error") return false;
      if (filter === "neverrun" && lastRuns[e.id]) return false;
      if (filter === "customscraper" && !hasCustomScraper(e.id)) return false;
      if (filter === "generic" && hasCustomScraper(e.id)) return false;
      if (methodFilter !== "all" && e.method !== methodFilter) return false;
      if (regionFilter !== "all" && (e.region ?? "") !== regionFilter) return false;
      if (!q) return true;
      return (e.name + " " + e.careersUrl + " " + e.homepage + " " + e.method + " " + (e.region ?? "") + " " + (hasCustomScraper(e.id) ? "scraper personnalisé sur mesure" : "scraper générique"))
        .toLowerCase()
        .includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employers, search, filter, methodFilter, regionFilter, counts, dupUrls, lastRuns]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const byName = (a: Employer, b: Employer) => a.name.localeCompare(b.name, "fr");
    if (sort === "jobsDesc") arr.sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0) || byName(a, b));
    else if (sort === "jobsAsc") arr.sort((a, b) => (counts[a.id] ?? 0) - (counts[b.id] ?? 0) || byName(a, b));
    else if (sort === "method") arr.sort((a, b) => a.method.localeCompare(b.method) || byName(a, b));
    else if (sort === "region") arr.sort((a, b) => (a.region ?? "").localeCompare(b.region ?? "") || byName(a, b));
    else if (sort === "lastRun") arr.sort((a, b) => (lastRuns[b.id]?.at ?? 0) - (lastRuns[a.id]?.at ?? 0) || byName(a, b));
    else arr.sort(byName);
    return arr;
  }, [filtered, sort, counts, lastRuns]);

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["id", "nom", "methode", "scraper_personnalise", "region", "offres", "verifie", "actif", "url"].join(",")];
    for (const e of sorted)
      lines.push(
        [e.id, e.name, e.method, hasCustomScraper(e.id) ? "oui" : "non", e.region ?? "", counts[e.id] ?? 0, e.verified ? "oui" : "non", e.enabled === false ? "non" : "oui", e.careersUrl]
          .map(esc)
          .join(","),
      );
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employeurs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const verifiedCount = employers.filter((e) => e.verified).length;
  const noJobsCount = employers.filter((e) => (counts[e.id] ?? 0) === 0).length;
  const disabledCount = employers.filter((e) => e.enabled === false).length;
  const dupCount = employers.filter((e) => isDup(e)).length;
  const errorCount = employers.filter((e) => lastRuns[e.id]?.status === "error").length;
  const neverRunCount = employers.filter((e) => !lastRuns[e.id]).length;
  const customScraperCount = employers.filter((e) => hasCustomScraper(e.id)).length;
  const totalOffers = employers.reduce((s, e) => s + (counts[e.id] ?? 0), 0);
  const scrapeEnabled = mode === "api" || !!ghToken;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageItems = sorted.slice((page - 1) * pageSize, page * pageSize);
  const pageIds = pageItems.map((e) => e.id);
  const selectedList = [...selected];
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  useEffect(() => setPage(1), [search, filter, methodFilter, regionFilter, sort, pageSize]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Administration des sources</h1>
        <p className="mt-1 text-sm text-slate-600">
          Vérifie, corrige les URLs et relance le scraping site par site.
        </p>
      </header>

      {/* #46 — Aperçu du diff avant publication de discovered.json */}
      {pendingPublish && (
        <div className="card mb-4 border-green-300 bg-white p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-800">Aperçu avant publication</h2>
            <span className="text-xs text-slate-500">
              {pendingPublish.diff.added.length} ajout(s) · {pendingPublish.diff.removed.length} retrait(s) ·{" "}
              {pendingPublish.diff.modified.length} modif(s)
            </span>
          </div>
          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto text-xs">
            {pendingPublish.diff.added.length > 0 && (
              <div>
                <p className="font-medium text-green-700">Ajouts</p>
                <ul className="ml-4 list-disc text-slate-600">
                  {pendingPublish.diff.added.map((e) => (
                    <li key={e.id}>{e.name ?? e.id} <span className="text-slate-400">({e.id})</span></li>
                  ))}
                </ul>
              </div>
            )}
            {pendingPublish.diff.removed.length > 0 && (
              <div>
                <p className="font-medium text-red-700">Retraits</p>
                <ul className="ml-4 list-disc text-slate-600">
                  {pendingPublish.diff.removed.map((e) => (
                    <li key={e.id}>{e.name ?? e.id} <span className="text-slate-400">({e.id})</span></li>
                  ))}
                </ul>
              </div>
            )}
            {pendingPublish.diff.modified.length > 0 && (
              <div>
                <p className="font-medium text-slate-700">Modifications</p>
                <ul className="ml-4 list-disc text-slate-600">
                  {pendingPublish.diff.modified.map((m) => (
                    <li key={m.id}>
                      <span className="font-medium">{m.name}</span>
                      <ul className="ml-4 list-[circle]">
                        {m.changes.map((c) => (
                          <li key={c.field}>
                            {c.field} : <span className="text-red-600">{JSON.stringify(c.before) ?? "∅"}</span> →{" "}
                            <span className="text-green-700">{JSON.stringify(c.after)}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={confirmPublish}
              disabled={publish.status === "run"}
              className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {publish.status === "run" ? "Publication…" : "✓ Confirmer la publication"}
            </button>
            <button
              onClick={() => setPendingPublish(null)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* #45 — Journal d'audit des actions admin (ce navigateur) */}
      <div className="mb-4">
        <button
          onClick={() => setAuditOpen((v) => !v)}
          className="text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          {auditOpen ? "▾" : "▸"} Journal d'audit ({auditLog.length})
        </button>
        {auditOpen && (
          <div className="card mt-2 p-3 text-xs">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-slate-500">
                Actions faites depuis ce navigateur. « Qui » = compte connecté quand disponible.
              </span>
              {auditLog.length > 0 && (
                <button onClick={clearAudit} className="text-slate-400 hover:text-red-600">
                  Vider
                </button>
              )}
            </div>
            {auditLog.length === 0 ? (
              <p className="text-slate-500">Aucune action enregistrée.</p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {auditLog.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 border-b border-slate-100 pb-1">
                    <span className="text-slate-400">{relTime(a.ts)}</span>
                    <span className="font-medium text-slate-700">{AUDIT_LABEL[a.action] ?? a.action}</span>
                    {a.targetName && <span className="text-slate-600">· {a.targetName}</span>}
                    {a.detail && <span className="text-slate-500">— {a.detail}</span>}
                    {a.actor && <span className="ml-auto text-slate-400">{a.actor}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {mode === "loading" && <p className="text-slate-500">Connexion…</p>}

      {mode !== "loading" && (
        <>
          <div
            className={`card mb-4 p-3 text-sm ${
              mode === "api" || mode === "turso"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {mode === "api" ? (
              <div className="flex flex-wrap items-center gap-2">
                <span>✅ <strong>Mode connecté</strong> — édition, vérification et re-scraping enregistrés dans <code>discovered.json</code>.</span>
                <button
                  onClick={publishChanges}
                  disabled={publish.status === "run"}
                  className="rounded-lg bg-green-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {publish.status === "run" ? "Publication…" : "⬆ Publier sur le site"}
                </button>
                {publish.status !== "idle" && publish.status !== "run" && (
                  <span className={publish.status === "ok" ? "text-green-700" : "text-red-600"}>{publish.message}</span>
                )}
              </div>
            ) : mode === "turso" ? (
              <div className="flex flex-col gap-2">
                <span>
                  ✅ <strong>Mode Turso</strong> — éditions et vérifications enregistrées <strong>en direct</strong> dans la base partagée.
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Sans jeton GitHub, le re-scrape (qui lance un workflow
                      GitHub) est impossible et TOUS les boutons « Re-scraper »
                      disparaissent — d'où leur absence sur un appareil (mobile)
                      où le jeton n'a jamais été saisi. */}
                  <button
                    onClick={() => setGhOpen((v) => !v)}
                    className="rounded-lg border border-green-300 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-green-100"
                  >
                    {ghToken ? "🔑 GitHub connecté" : "🔗 Connecter GitHub (pour re-scraper)"}
                  </button>
                  {ghToken && (
                    <button
                      onClick={ghTriggerDeploy}
                      disabled={publish.status === "run"}
                      className="rounded-lg bg-green-700 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {publish.status === "run" ? "Reconstruction…" : "🔁 Reconstruire le site"}
                    </button>
                  )}
                  {!ghToken && (
                    <span className="text-green-700">Le site se reconstruira au prochain déploiement.</span>
                  )}
                  {publish.status !== "idle" && publish.status !== "run" && (
                    <span className={publish.status === "ok" ? "text-green-700" : "text-red-600"}>{publish.message}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <span>
                  ⚠️ <strong>Mode lecture</strong> (API non détectée). Les modifications de fiches sont{" "}
                  <strong>locales à ce navigateur</strong> et ne sont <strong>pas enregistrées dans la base partagée</strong> —
                  connecte <strong>Turso</strong> ci-dessous pour éditer les employeurs pour de vrai. (Le jeton GitHub sert, lui, à
                  <strong> scraper</strong> et <strong>publier</strong>.)
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => setGhOpen((v) => !v)} className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-amber-100">
                    {ghToken ? "🔑 GitHub connecté" : "🔗 Connecter GitHub"}
                  </button>
                  {ghToken && (
                    <button onClick={preparePublish} disabled={publish.status === "run"} className="rounded-lg bg-green-700 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">
                      {publish.status === "run" ? "Publication…" : "⬆ Publier sur GitHub"}
                    </button>
                  )}
                  <button onClick={exportJson} className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-amber-100">
                    ⬇ Exporter (télécharger)
                  </button>
                  {publish.status !== "idle" && publish.status !== "run" && (
                    <span className={publish.status === "ok" ? "text-green-700" : "text-red-600"}>{publish.message}</span>
                  )}
                </div>
              </div>
            )}
            {/* Panneau de connexion GitHub — partagé par les modes Turso et
                lecture. Le re-scrape passe par un workflow GitHub : sans jeton,
                aucun bouton « Re-scraper » n'apparaît. Le rendre accessible ici
                le débloque sur tout appareil (mobile compris). */}
            {ghOpen && (
              <div className="mt-2 rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-700">
                <p className="mb-1">
                  Colle un <strong>jeton GitHub à granularité fine</strong> (fine-grained PAT) limité au dépôt
                  <code> {ghRepo().owner}/{ghRepo().repo}</code>, avec les permissions <strong>Contents : lecture/écriture</strong> et
                  <strong> Actions : lecture/écriture</strong>. Il est stocké <strong>uniquement dans ce navigateur</strong> (rien n'est envoyé ailleurs qu'à GitHub).
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={ghToken}
                    onChange={(e) => saveToken(e.target.value.trim())}
                    placeholder="github_pat_…"
                    className="flex-1 rounded border border-slate-300 px-2 py-1 font-mono"
                  />
                  {ghToken && (
                    <button onClick={() => saveToken("")} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100">
                      Oublier
                    </button>
                  )}
                </div>
                <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-brand-600 hover:underline">
                  Créer un jeton →
                </a>
              </div>
            )}
          </div>

          <details className="card mb-4 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-slate-700">
              {mode === "turso" ? "🗄️ Turso connecté (base partagée)" : "🗄️ Connecter Turso (base partagée)"}
            </summary>
            <div className="mt-2 flex flex-col gap-2 text-slate-600">
              <p>
                Colle l'URL <code>libsql://…</code> et un jeton Turso : l'admin lit et écrit alors
                <strong> directement dans la base</strong> (édition en direct, plus de fichier à publier). Stocké
                uniquement dans ce navigateur.
              </p>
              <input
                type="text"
                value={tursoUrl}
                onChange={(e) => setTursoUrl(e.target.value)}
                placeholder="libsql://jobccq-….turso.io"
                className="rounded border border-slate-300 px-2 py-1 font-mono"
              />
              <input
                type="password"
                value={tursoToken}
                onChange={(e) => setTursoToken(e.target.value)}
                placeholder="jeton Turso (lecture/écriture)"
                className="rounded border border-slate-300 px-2 py-1 font-mono"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    saveTurso(tursoUrl.trim(), tursoToken.trim());
                    location.reload();
                  }}
                  className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white"
                >
                  Enregistrer + recharger
                </button>
                {(tursoUrl || tursoToken) && (
                  <button
                    onClick={() => {
                      saveTurso("", "");
                      location.reload();
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs"
                  >
                    Oublier
                  </button>
                )}
              </div>
            </div>
          </details>

          {authEnabled && authUser && (
            <details className="card mb-4 p-3 text-sm">
              <summary className="cursor-pointer font-medium text-slate-700">
                🔐 Coffre-fort — synchroniser mes identifiants (chiffré)
              </summary>
              <div className="mt-2 flex flex-col gap-2 text-slate-600">
                <p>
                  Sauvegarde ton <strong>jeton GitHub</strong> et tes <strong>identifiants Turso</strong> dans
                  ton compte, <strong>chiffrés</strong> avec une phrase secrète que toi seul connais — pour les
                  retrouver sur un autre appareil. La phrase n'est <strong>jamais</strong> envoyée ni stockée ;
                  tu la saisis une fois par appareil.
                </p>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Phrase secrète (≥ 8 caractères)"
                  autoComplete="new-password"
                  className="rounded border border-slate-300 px-2 py-1"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={vaultSave}
                    disabled={vault.busy !== "idle"}
                    className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {vault.busy === "save" ? "Chiffrement…" : "🔒 Enregistrer dans mon compte"}
                  </button>
                  <button
                    onClick={vaultRestore}
                    disabled={vault.busy !== "idle"}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50"
                  >
                    {vault.busy === "load" ? "Déchiffrement…" : "⬇ Restaurer depuis mon compte"}
                  </button>
                  <button
                    onClick={vaultForget}
                    disabled={vault.busy !== "idle"}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100 disabled:opacity-50"
                  >
                    Supprimer le coffre
                  </button>
                </div>
                {vault.msg && (
                  <p className={vault.tone === "ok" ? "text-green-700" : "text-red-600"}>{vault.msg}</p>
                )}
                <p className="text-xs text-slate-400">
                  Connecté : {authUser.email}. Chiffrement AES-GCM côté navigateur ; la base ne stocke qu'un
                  blob illisible sans ta phrase.
                </p>
              </div>
            </details>
          )}

          {stale && (
            <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">
              <span>⚠️ <strong>Version périmée</strong> — des données plus récentes ont été publiées ailleurs. Recharge avant d'éditer ou de publier, sinon tu risques d'écraser ces changements.</span>
              <button
                onClick={reloadData}
                disabled={reloading}
                className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {reloading ? "Rechargement…" : "🔄 Recharger maintenant"}
              </button>
            </div>
          )}

          {/* Tableau de bord : indicateurs clés cliquables (filtre associé). */}
          <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {[
              { label: "Employeurs", value: employers.length, f: "all" as FilterKey },
              { label: "Offres", value: totalOffers, f: null },
              { label: "Vérifiés", value: verifiedCount, f: "verified" as FilterKey },
              { label: "Désactivés", value: disabledCount, f: "disabled" as FilterKey },
              { label: "Sans offres", value: noJobsCount, f: "nojobs" as FilterKey },
              { label: "Scrapers perso", value: customScraperCount, f: "customscraper" as FilterKey },
              { label: "Doublons", value: dupCount, f: "duplicates" as FilterKey },
              { label: "En erreur", value: errorCount, f: "errors" as FilterKey },
            ].map((k) => (
              <button
                key={k.label}
                onClick={() => k.f && changeFilter(k.f)}
                className={`card p-2 text-center transition ${k.f ? "cursor-pointer hover:border-brand-300" : "cursor-default"} ${
                  k.f && filter === k.f ? "border-brand-400 bg-brand-50" : ""
                }`}
              >
                <div className="text-lg font-bold text-slate-800">{k.value}</div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500">{k.label}</div>
              </button>
            ))}
          </div>

          {mode === "turso" && (
            <details
              className="card mb-4 p-3 text-sm"
              onToggle={(ev) => {
                if ((ev.currentTarget as HTMLDetailsElement).open && activity.rows.length === 0 && !activity.loading) loadActivity();
              }}
            >
              <summary className="cursor-pointer font-medium text-slate-700">📊 Activité récente (derniers scrapes)</summary>
              <div className="mt-2">
                <div className="mb-2">
                  <button
                    onClick={loadActivity}
                    disabled={activity.loading}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-100 disabled:opacity-50"
                  >
                    {activity.loading ? "Chargement…" : "🔄 Actualiser"}
                  </button>
                </div>
                {activity.error ? (
                  <p className="text-red-600">Erreur : {activity.error}</p>
                ) : activity.rows.length === 0 && !activity.loading ? (
                  <p className="text-slate-500">Aucune exécution enregistrée.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {activity.rows.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center gap-x-2 py-1 text-xs">
                        <span className="shrink-0">{r.status === "error" ? "❌" : r.status === "running" ? "⏳" : "✅"}</span>
                        <span className="font-medium text-slate-700">{nameById[r.sourceId] ?? r.sourceId}</span>
                        <span className="text-slate-400">{relTime(r.at)}</span>
                        {r.status === "error" ? (
                          <span className="truncate text-red-600" title={r.error}>{r.error}</span>
                        ) : (
                          <span className="text-slate-500">
                            {r.found} trouvée(s){r.inserted ? ` · +${r.inserted}` : ""}{r.updated ? ` · ~${r.updated}` : ""}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          )}

          <div className="card mb-4 flex flex-col gap-2 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={search}
                onChange={(e) => changeSearch(e.target.value)}
                placeholder="Rechercher (nom, URL, méthode, région)…"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
              <select
                value={filter}
                onChange={(e) => changeFilter(e.target.value as FilterKey)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              >
                <option value="all">Tous ({employers.length})</option>
                <option value="unverified">À vérifier ({employers.length - verifiedCount})</option>
                <option value="verified">Vérifiés ({verifiedCount})</option>
                <option value="customscraper">Scraper personnalisé ({customScraperCount})</option>
                <option value="generic">Scraper générique ({employers.length - customScraperCount})</option>
                <option value="nojobs">Sans offres ({noJobsCount})</option>
                <option value="disabled">Désactivées ({disabledCount})</option>
                <option value="duplicates">Doublons ({dupCount})</option>
                <option value="errors">En erreur ({errorCount})</option>
                {mode === "turso" && <option value="neverrun">Jamais scrapé ({neverRunCount})</option>}
              </select>
              <select
                value={methodFilter}
                onChange={(e) => changeMethodFilter(e.target.value as "all" | DiscoveredMethod)}
                title="Filtrer par méthode de scraping"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              >
                <option value="all">Toutes méthodes</option>
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {regions.length > 0 && (
                <select
                  value={regionFilter}
                  onChange={(e) => changeRegionFilter(e.target.value)}
                  title="Filtrer par région"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                >
                  <option value="all">Toutes régions</option>
                  {regions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              )}
              <select
                value={sort}
                onChange={(e) => changeSort(e.target.value as SortKey)}
                title="Trier"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              >
                {SORT_KEYS.map((s) => (
                  <option key={s} value={s}>⇅ {SORT_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={reloadData}
                disabled={reloading}
                title="Récupérer la dernière version des données"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
              >
                {reloading ? "Rechargement…" : "🔄 Recharger"}
              </button>
              <button onClick={exportCsv} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-100">
                ⬇ CSV
              </button>
              <button
                onClick={() => setAddOpen((v) => !v)}
                className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                ➕ Ajouter un employeur
              </button>
              {ghToken && (
                <button
                  onClick={ghScrapeAll}
                  disabled={scrapeAll.status === "run"}
                  title="Lancer un scrape complet de toutes les sources (workflow GitHub, ~1 h)"
                  className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                >
                  {scrapeAll.status === "run" ? "Lancement…" : "🚀 Scrape complet"}
                </button>
              )}
              {scrapeAll.status !== "idle" && scrapeAll.status !== "run" && (
                <span className={`text-xs ${scrapeAll.status === "ok" ? "text-green-700" : "text-red-600"}`}>{scrapeAll.message}</span>
              )}
              {mode === "static" && (
                <button onClick={exportJson} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-100">
                  ⬇ JSON
                </button>
              )}
              {bulkMsg && <span className="text-xs text-slate-500">{bulkMsg}</span>}
            </div>
          </div>

          {addOpen && (
            <div className="card mb-4 p-3 text-sm">
              <div className="mb-2 font-medium text-slate-700">➕ Nouvel employeur</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input placeholder="id (ex. ma-compagnie-com)" value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} className="rounded border border-slate-300 px-2 py-1 font-mono text-xs" />
                <input placeholder="Nom" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="rounded border border-slate-300 px-2 py-1 text-xs" />
                <input placeholder="URL carrières (https://…)" value={form.careersUrl} onChange={(e) => setForm((f) => ({ ...f, careersUrl: e.target.value }))} className="rounded border border-slate-300 px-2 py-1 font-mono text-xs sm:col-span-2" />
                <input placeholder="Site web (optionnel — déduit de l'URL)" value={form.homepage} onChange={(e) => setForm((f) => ({ ...f, homepage: e.target.value }))} className="rounded border border-slate-300 px-2 py-1 font-mono text-xs" />
                <select value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} className="rounded border border-slate-300 px-2 py-1 text-xs">
                  <option value="">Région (optionnel)</option>
                  {REGION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as DiscoveredMethod }))} className="rounded border border-slate-300 px-2 py-1 text-xs">
                  {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={addEmployer} className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white">Ajouter</button>
                <button onClick={() => setAddOpen(false)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100">Annuler</button>
              </div>
            </div>
          )}

          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <label className="flex items-center gap-1.5" title="Tout sélectionner sur la page">
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={(e) =>
                  setSelected((s) => {
                    const n = new Set(s);
                    pageIds.forEach((id) => (e.target.checked ? n.add(id) : n.delete(id)));
                    return n;
                  })
                }
                className="h-4 w-4 accent-brand-600"
              />
              <span>page</span>
            </label>
            <span>
              {sorted.length} résultat{sorted.length > 1 ? "s" : ""} · vérifiés {verifiedCount}/{employers.length}
            </span>
            {sorted.length > 0 && (
              <button
                onClick={() =>
                  setSelected((s) => {
                    const n = new Set(s);
                    const all = sorted.every((e) => n.has(e.id));
                    sorted.forEach((e) => (all ? n.delete(e.id) : n.add(e.id)));
                    return n;
                  })
                }
                className="rounded border border-slate-200 px-2 py-0.5 text-xs font-medium hover:bg-slate-100"
              >
                {sorted.every((e) => selected.has(e.id)) ? "Tout désélectionner" : `Tout sélectionner (${sorted.length})`}
              </button>
            )}
            <label className="ml-auto flex items-center gap-1.5 text-xs" title="Nombre d'employeurs par page">
              <span>Par page :</span>
              <select
                value={pageSize}
                onChange={(ev) => changePageSize(Number(ev.target.value))}
                className="rounded border border-slate-200 px-1.5 py-0.5 text-xs"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
                <option value={100000}>Tout</option>
              </select>
            </label>
          </div>

          {selected.size > 0 && (
            <div className="card mb-2 flex flex-wrap items-center gap-2 border-brand-200 bg-brand-50 p-2 text-xs">
              <span className="font-semibold text-brand-800">{selected.size} sélectionné(s)</span>
              {scrapeEnabled && (
                <button onClick={() => bulkRescrape(selectedList)} className="rounded-lg border border-brand-300 bg-white px-2.5 py-1 font-semibold text-brand-700 hover:bg-brand-100">
                  🔄 Re-scraper
                </button>
              )}
              <button onClick={() => bulkSetEnabled(selectedList, true)} className="rounded-lg border border-green-300 bg-white px-2.5 py-1 font-semibold text-green-700 hover:bg-green-50">
                ✅ Activer
              </button>
              <button onClick={() => bulkSetEnabled(selectedList, false)} className="rounded-lg border border-red-300 bg-white px-2.5 py-1 font-semibold text-red-600 hover:bg-red-50">
                🚫 Désactiver
              </button>
              <button onClick={() => bulkSetVerified(selectedList, true)} className="rounded-lg border border-green-300 bg-white px-2.5 py-1 font-semibold text-green-700 hover:bg-green-50">
                ✔ Vérifier
              </button>
              <button onClick={() => bulkSetVerified(selectedList, false)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-100">
                ✖ Dévérifier
              </button>
              <select
                value=""
                onChange={(ev) => {
                  if (ev.target.value) bulkSetMethod(selectedList, ev.target.value as DiscoveredMethod);
                }}
                title="Appliquer une méthode de scraping à la sélection"
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700"
              >
                <option value="">Méthode…</option>
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <button
                onClick={() => bulkCopyUrls(selectedList)}
                title="Copier les URLs carrières des employeurs sélectionnés"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100"
              >
                📋 Copier URLs
              </button>
              {(mode === "turso" || mode === "api") && (
                <button onClick={() => bulkPurge(selectedList)} className="rounded-lg border border-red-300 bg-white px-2.5 py-1 font-semibold text-red-600 hover:bg-red-50">
                  🗑 Vider les offres
                </button>
              )}
              {(mode === "turso" || mode === "api" || mode === "static") && (
                <button onClick={() => bulkDelete(selectedList)} className="rounded-lg border border-red-400 bg-white px-2.5 py-1 font-semibold text-red-700 hover:bg-red-50">
                  ✕ Supprimer
                </button>
              )}
              <button onClick={() => setSelected(new Set())} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 hover:bg-slate-100">
                Désélectionner
              </button>
            </div>
          )}

          <div className="space-y-2">
            {pageItems.map((e) => (
              <Row
                key={e.id}
                e={e}
                count={counts[e.id] ?? 0}
                scrape={scrapes[e.id]}
                scrapeEnabled={scrapeEnabled}
                purgeEnabled={mode === "api" || mode === "turso"}
                deleteEnabled={mode === "api" || mode === "turso" || mode === "static"}
                selected={selected.has(e.id)}
                duplicate={isDup(e)}
                lastRun={lastRuns[e.id]}
                offersOpen={openOffers.has(e.id)}
                offers={offersData[e.id]}
                forceEnabled={!!ghToken}
                save={saveState[e.id]}
                sectorOptions={sectorOptions}
                mode={mode}
                tursoUrl={tursoUrl}
                tursoToken={tursoToken}
                onToggleSelect={toggleSelect}
                onPatch={patchEmployer}
                onScrape={scrapeOne}
                onScrapeForce={scrapeForce}
                onPurge={purgeOffers}
                onDelete={deleteEmployer}
                onToggleOffers={toggleOffers}
                onMutateOffer={(employerId, offerId, patch) =>
                  setOffersData((d) => {
                    const prev = d[employerId] ?? { loading: false, rows: [] };
                    const rows = prev.rows.map((r) => (r.id === offerId ? { ...r, ...patch } : r));
                    return { ...d, [employerId]: { ...prev, rows } };
                  })
                }
                onShowDuplicates={() => changeFilter("duplicates")}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40">
                ← Précédent
              </button>
              <span className="text-slate-500">Page {page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40">
                Suivant →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Petit indicateur d'enregistrement affiché à côté du bouton « Enregistrer ». */
function SaveBadge({ save }: { save: SaveState }) {
  if (!save.s) return null;
  if (save.s === "saving") return <span className="text-xs text-slate-500">💾 Enregistrement…</span>;
  if (save.s === "ok") return <span className="text-xs font-semibold text-green-700">✓ Enregistré</span>;
  if (save.s === "local")
    return (
      <span className="text-xs font-semibold text-amber-700" title="Modification locale à ce navigateur : connecte Turso pour l'enregistrer dans la base partagée.">
        ⚠ Local seulement
      </span>
    );
  return (
    <span className="text-xs font-semibold text-red-600" title={save.msg}>
      ✗ Échec — non enregistré{save.msg ? ` (${save.msg})` : ""}
    </span>
  );
}

function Row({
  e, count, scrape, scrapeEnabled, purgeEnabled, deleteEnabled, selected, duplicate, lastRun, offersOpen, offers, forceEnabled, save, sectorOptions, mode, tursoUrl, tursoToken, onToggleSelect, onPatch, onScrape, onScrapeForce, onPurge, onDelete, onToggleOffers, onMutateOffer, onShowDuplicates,
}: {
  e: Employer;
  count: number;
  scrape?: ScrapeState;
  scrapeEnabled: boolean;
  purgeEnabled: boolean;
  deleteEnabled: boolean;
  selected: boolean;
  duplicate: boolean;
  lastRun?: LastRun;
  offersOpen: boolean;
  offers?: OffersState;
  forceEnabled: boolean;
  save?: SaveState;
  sectorOptions: string[];
  mode: Mode;
  tursoUrl: string;
  tursoToken: string;
  onToggleSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<Employer>) => void;
  onScrape: (id: string) => void;
  onScrapeForce: (id: string) => void;
  onPurge: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleOffers: (id: string) => void;
  onMutateOffer: (employerId: string, offerId: string, patch: OfferPatch) => void;
  onShowDuplicates: () => void;
}) {
  const [url, setUrl] = useState(e.careersUrl);
  const [name, setName] = useState(e.name);
  useEffect(() => { setUrl(e.careersUrl); setName(e.name); }, [e.careersUrl, e.name]);

  const dirty = url !== e.careersUrl || name !== e.name;

  // Édition avancée (repliée par défaut) : champs acceptés par le backend mais
  // absents de la ligne principale (région, site web, portée).
  const [advOpen, setAdvOpen] = useState(false);
  const [region, setRegion] = useState(e.region ?? "");
  const [homepage, setHomepage] = useState(e.homepage ?? "");
  const [scope, setScope] = useState(e.scope ?? "");
  const [rbq, setRbq] = useState(e.rbq ?? "");
  const [sectors, setSectors] = useState<string[]>(e.sectors ? [...e.sectors] : []);
  const [secOpen, setSecOpen] = useState(false);
  const [newSec, setNewSec] = useState("");
  const eSectorsKey = (e.sectors ?? []).join("|");
  useEffect(() => {
    setRegion(e.region ?? "");
    setHomepage(e.homepage ?? "");
    setScope(e.scope ?? "");
    setRbq(e.rbq ?? "");
    setSectors(e.sectors ? [...e.sectors] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.region, e.homepage, e.scope, e.rbq, eSectorsKey]);
  const sectorsDirty = [...sectors].sort().join("|") !== [...(e.sectors ?? [])].sort().join("|");
  const advDirty =
    region !== (e.region ?? "") ||
    homepage !== (e.homepage ?? "") ||
    scope !== (e.scope ?? "") ||
    rbq !== (e.rbq ?? "") ||
    sectorsDirty;
  const toggleSector = (s: string) =>
    setSectors((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  const addSector = () => {
    const v = newSec.trim();
    if (v && !sectors.includes(v)) setSectors((cur) => [...cur, v]);
    setNewSec("");
  };

  const disabled = e.enabled === false;
  return (
    <article
      className={`card p-3 ${disabled ? "opacity-60" : ""} ${
        selected ? "ring-2 ring-brand-400" : disabled ? "ring-1 ring-red-300" : e.verified ? "ring-1 ring-green-300" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(e.id)}
          title="Sélectionner"
          className="h-4 w-4 shrink-0 accent-brand-600"
        />
        <label className="flex shrink-0 items-center gap-1.5 text-sm" title="Marquer comme vérifié">
          <input
            type="checkbox"
            checked={!!e.verified}
            onChange={(ev) => onPatch(e.id, { verified: ev.target.checked })}
            className="h-4 w-4 accent-green-600"
          />
          {e.verified ? <Badge tone="green">Vérifié</Badge> : <span className="text-slate-400">à vérifier</span>}
        </label>
        <input
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          className="min-w-[10rem] flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold hover:border-slate-200 focus:border-brand-400 focus:outline-none"
        />
        <select
          value={e.method}
          onChange={(ev) => onPatch(e.id, { method: ev.target.value as DiscoveredMethod })}
          className="rounded border border-slate-200 px-1.5 py-0.5 text-xs"
        >
          {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        {e.region && <Badge>{e.region}</Badge>}
        <Badge tone={hasCustomScraper(e.id) ? "green" : "slate"}>
          {hasCustomScraper(e.id) ? "Scraper perso" : "Générique"}
        </Badge>
        {e.rbq && <span className="font-mono text-xs text-slate-400" title="Numéro de licence RBQ">RBQ {e.rbq}</span>}
        {count > 0 ? (
          <Link
            href={`/emplois?sources=${e.id}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Voir les offres de cette compagnie"
            className="rounded-full"
          >
            <Badge tone="brand">{count} offre{count > 1 ? "s" : ""} ↗</Badge>
          </Link>
        ) : (
          <Badge tone="slate">0 offre</Badge>
        )}
        {duplicate && (
          <button
            type="button"
            onClick={onShowDuplicates}
            title="Plusieurs employeurs partagent cette même URL de carrières — cliquer pour afficher tous les doublons"
            className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-200"
          >
            ⚠ doublon
          </button>
        )}
        <span
          title={
            lastRun
              ? lastRun.error
                ? `Dernier scrape en erreur : ${lastRun.error}`
                : `Dernier scrape ${relTime(lastRun.at)} — ${lastRun.found} trouvée(s)`
              : "Jamais scrapé (ou base sans historique)"
          }
          className={`ml-auto shrink-0 text-[11px] ${
            !lastRun
              ? "text-slate-300"
              : lastRun.status === "error"
                ? "text-red-600"
                : lastRun.status === "running"
                  ? "text-amber-600"
                  : "text-slate-400"
          }`}
        >
          {!lastRun
            ? "◦ jamais"
            : lastRun.status === "error"
              ? `❌ ${relTime(lastRun.at)}`
              : lastRun.status === "running"
                ? "⏳ en cours"
                : `✅ ${relTime(lastRun.at)}`}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={url}
          onChange={(ev) => setUrl(ev.target.value)}
          spellCheck={false}
          className="min-w-[16rem] flex-1 rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs outline-none focus:border-brand-400"
        />
        <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-100" title="Ouvrir">
          Ouvrir ↗
        </a>
        {count > 0 && (
          <button
            onClick={() => onToggleOffers(e.id)}
            title="Afficher les offres actuellement en base pour cet employeur"
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-100"
          >
            {offersOpen ? "▴ Offres" : "▾ Offres"}
          </button>
        )}
        <button
          onClick={() => setAdvOpen((v) => !v)}
          title="Édition avancée (région, site web, portée)"
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-100"
        >
          {advOpen ? "▴ Détails" : "⚙ Détails"}
        </button>
        <button
          disabled={!dirty}
          onClick={() => onPatch(e.id, { careersUrl: url.trim(), name: name.trim() })}
          className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-30"
        >
          Enregistrer
        </button>
        {save && <SaveBadge save={save} />}
        {scrapeEnabled && !disabled && (
          <button
            onClick={() => onScrape(e.id)}
            className="rounded-lg border border-brand-300 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
          >
            {scrape?.status === "run" ? "Scraping…" : "Re-scraper"}
          </button>
        )}
        <button
          onClick={() => onPatch(e.id, { enabled: disabled })}
          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
            disabled
              ? "border-green-300 text-green-700 hover:bg-green-50"
              : "border-red-300 text-red-600 hover:bg-red-50"
          }`}
        >
          {disabled ? "Activer" : "Désactiver"}
        </button>
        {purgeEnabled && count > 0 && (
          <button
            onClick={() => onPurge(e.id)}
            title="Supprimer toutes les offres de cet employeur (remise à zéro)"
            className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            🗑 Vider les offres
          </button>
        )}
        {deleteEnabled && (
          <button
            onClick={() => onDelete(e.id)}
            title="Supprimer définitivement cet employeur (fiche + offres)"
            className="ml-auto rounded-lg border border-red-400 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
          >
            Supprimer
          </button>
        )}
      </div>

      {offersOpen && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
          {!offers || offers.loading ? (
            <span className="text-slate-500">Chargement des offres…</span>
          ) : offers.error ? (
            <span className="text-red-600">Erreur : {offers.error}</span>
          ) : offers.rows.length === 0 ? (
            <span className="text-slate-500">Aucune offre en base pour cet employeur.</span>
          ) : (
            <>
              <div className="mb-1 text-[10px] text-slate-400">
                {offers.rows.length} affichée(s){count > offers.rows.length ? ` sur ${count}` : ""} — cliquer sur une offre pour l’éditer dans une fenêtre.
              </div>
              <ul className="space-y-1">
                {offers.rows.map((o) => (
                  <li key={o.id}>
                    <OfferRowItem
                      o={o}
                      persistEnabled={mode !== "loading"}
                      mode={mode}
                      tursoUrl={tursoUrl}
                      tursoToken={tursoToken}
                      onMutate={(id, patch) => onMutateOffer(e.id, id, patch)}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {advOpen && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-slate-500">id :</span>
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-700 ring-1 ring-slate-200">{e.id}</code>
            <button
              onClick={() => navigator.clipboard?.writeText(e.id).catch(() => {})}
              title="Copier l'id"
              className="rounded border border-slate-200 px-1.5 py-0.5 hover:bg-slate-100"
            >
              ⧉ copier
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-500">Région</span>
              <select
                value={region}
                onChange={(ev) => setRegion(ev.target.value)}
                className="rounded border border-slate-300 px-2 py-1"
              >
                <option value="">— Aucune —</option>
                {region !== "" && !REGION_OPTIONS.includes(region) && (
                  <option value={region}>{region} (actuel)</option>
                )}
                {REGION_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-500">Site web</span>
              <input value={homepage} onChange={(ev) => setHomepage(ev.target.value)} spellCheck={false} className="rounded border border-slate-300 px-2 py-1 font-mono" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-500">Portée (scope)</span>
              <input value={scope} onChange={(ev) => setScope(ev.target.value)} className="rounded border border-slate-300 px-2 py-1" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-500">N° RBQ</span>
              <input
                value={rbq}
                onChange={(ev) => setRbq(ev.target.value)}
                spellCheck={false}
                placeholder="1234-5678-90"
                className="rounded border border-slate-300 px-2 py-1 font-mono"
              />
            </label>
          </div>

          {/* Secteurs : menu déroulant à cocher (plusieurs) + puces retirables. */}
          <div className="relative mt-2">
            <span className="text-slate-500">Secteurs</span>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setSecOpen((v) => !v)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-medium hover:bg-slate-100"
              >
                {sectors.length ? `${sectors.length} secteur${sectors.length > 1 ? "s" : ""}` : "Choisir…"} ▾
              </button>
              {sectors.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200">
                  {s}
                  <button type="button" onClick={() => toggleSector(s)} title="Retirer" className="text-slate-400 hover:text-red-600">×</button>
                </span>
              ))}
            </div>
            {secOpen && (
              <>
                <button aria-hidden tabIndex={-1} onClick={() => setSecOpen(false)} className="fixed inset-0 z-10 cursor-default" />
                <div className="absolute left-0 z-20 mt-1 max-h-64 w-72 overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                  {sectorOptions.length === 0 && <p className="px-1 py-0.5 text-slate-400">Aucun secteur connu — ajoute le premier ci-dessous.</p>}
                  {sectorOptions.map((s) => (
                    <label key={s} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-50">
                      <input type="checkbox" checked={sectors.includes(s)} onChange={() => toggleSector(s)} className="h-3.5 w-3.5 accent-brand-600" />
                      <span>{s}</span>
                    </label>
                  ))}
                  <div className="mt-1 flex gap-1 border-t border-slate-100 pt-1">
                    <input
                      value={newSec}
                      onChange={(ev) => setNewSec(ev.target.value)}
                      onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); addSector(); } }}
                      placeholder="Ajouter un secteur…"
                      className="min-w-0 flex-1 rounded border border-slate-300 px-1.5 py-0.5"
                    />
                    <button type="button" onClick={addSector} className="rounded border border-slate-300 px-2 py-0.5 font-semibold hover:bg-slate-100">+</button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              disabled={!advDirty}
              onClick={() =>
                onPatch(e.id, {
                  region: region.trim(),
                  homepage: homepage.trim(),
                  scope: scope.trim(),
                  rbq: rbq.trim(),
                  sectors,
                })
              }
              className="rounded-lg bg-brand-600 px-2.5 py-1 font-semibold text-white disabled:opacity-30"
            >
              Enregistrer les détails
            </button>
            {save && <SaveBadge save={save} />}
            {forceEnabled && !disabled && (
              <button
                onClick={() => onScrapeForce(e.id)}
                title="Re-scraper en ignorant le garde-fou anti-purge (remplace les offres même si le site en renvoie moins/zéro). Pour un employeur mal configuré."
                className="rounded-lg border border-amber-400 px-2.5 py-1 font-semibold text-amber-700 hover:bg-amber-50"
              >
                ⚡ Re-scraper (forcé)
              </button>
            )}
          </div>
        </div>
      )}

      {scrape && scrape.status !== "run" && (
        <div className="mt-2 text-xs">
          {scrape.status === "ok" && scrape.error === "launched" ? (
            <span className="text-green-700">🚀 Scraping lancé sur GitHub — le compteur se mettra à jour tout seul dans ~1 min (sans recharger).</span>
          ) : scrape.status === "ok" && scrape.error === "updated" ? (
            <span className="text-green-700">
              ✅ Compteur à jour : {scrape.found} offre{(scrape.found ?? 0) > 1 ? "s" : ""} (base rafraîchie, sans recharger).
            </span>
          ) : scrape.status === "ok" && scrape.error === "timeout" ? (
            <span className="text-amber-700">
              ⏳ Le scrape prend plus de temps que prévu (Jobillico est plus lent). Il se termine en arrière-plan —
              le compteur ci-dessus a été resynchronisé depuis la base ; recharge dans une minute s'il n'a pas bougé.
            </span>
          ) : scrape.status === "ok" ? (
            <div className={scrape.found ? "text-green-700" : "text-amber-700"}>
              {scrape.found} poste{(scrape.found ?? 0) > 1 ? "s" : ""} trouvé{(scrape.found ?? 0) > 1 ? "s" : ""}
              {scrape.sample && scrape.sample.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-slate-500">
                  {scrape.sample.slice(0, 6).map((j, i) => (
                    <li key={i}>{j.title}{j.city ? ` · ${j.city}` : ""}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <span className="text-red-600">Erreur : {scrape.error}</span>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * Ligne d'offre dans le panneau employeur : clic pour ouvrir une modale d'édition
 * avec AdminOfferEditor. Persiste via API (api/Turso) ou en mode statique affiche
 * un avertissement local-only.
 */
function OfferRowItem({
  o,
  persistEnabled,
  mode,
  tursoUrl,
  tursoToken,
  onMutate,
}: {
  o: OfferRow;
  persistEnabled: boolean;
  mode: Mode;
  tursoUrl: string;
  tursoToken: string;
  onMutate: (id: string, patch: OfferPatch) => void;
}) {
  const [open, setOpen] = useState(false);
  const [save, setSave] = useState<SaveState>();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Publie l'édition dans l'overlay Supabase (table `job_overrides`) pour que le
  // site public statique la reflète **immédiatement, sans redéploiement**. Best
  // effort : l'écriture en base (Turso/API) reste la source de vérité — si
  // l'overlay échoue (RLS, table absente…), on ne fait pas échouer la sauvegarde,
  // la correction reviendra de toute façon au prochain rebuild.
  const publishOverlay = async (id: string, patch: OfferPatch) => {
    if (!supabaseEnabled) return;
    try {
      await upsertJobOverride(id, patch);
      invalidateJobOverrides();
    } catch (err) {
      console.warn("Overlay Supabase non écrit :", (err as Error).message);
    }
  };

  const doSave = async (id: string, patch: OfferPatch) => {
    if (mode === "api" || mode === "turso") {
      setSave({ s: "saving" });
      try {
        if (mode === "turso") {
          const tUrl = tursoUrl || readLS(LS_TURSO_URL);
          const tTok = tursoToken || readLS(LS_TURSO_TOKEN);
          const cols: string[] = [];
          const args: unknown[] = [];
          const strFields: (keyof OfferPatch)[] = [
            "title", "company", "url", "location", "city", "regionId", "remote",
            "categoryId", "employmentType", "salaryPeriod", "currency", "description", "companyLogoUrl",
          ];
          for (const k of strFields) {
            if (k in patch) {
              cols.push(`${k}=?`);
              args.push((patch as Record<string, unknown>)[k] ?? null);
            }
          }
          if ("salaryMin" in patch) { cols.push("salaryMin=?"); args.push(patch.salaryMin ?? null); }
          if ("salaryMax" in patch) { cols.push("salaryMax=?"); args.push(patch.salaryMax ?? null); }
          if ("tags" in patch) { cols.push("tags=?"); args.push(JSON.stringify(patch.tags ?? [])); }
          if ("languages" in patch) { cols.push("languages=?"); args.push(JSON.stringify(patch.languages ?? [])); }
          if ("postedAt" in patch) {
            cols.push("postedAt=?");
            args.push(patch.postedAt ? new Date(patch.postedAt).toISOString() : null);
          }
          if (!cols.length) return;
          cols.push("updatedAt=?");
          args.push(new Date().toISOString());
          args.push(id);
          await tursoExec(tUrl, tTok, `UPDATE Job SET ${cols.join(",")} WHERE id=?`, args);
        } else {
          const res = await adminFetch(`${API_URL}/admin/jobs/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        }
        onMutate(id, patch);
        // Réplique l'édition dans l'overlay public (effet immédiat sur le site).
        await publishOverlay(id, patch);
        setSave({ s: "ok" });
        notifyJobsChanged();
      } catch (err) {
        setSave({ s: "err", msg: (err as Error).message });
      }
      setTimeout(() => setSave(undefined), 2500);
      return;
    }
    // Mode statique : aucune base joignable. Si Supabase est configuré, on publie
    // quand même l'édition via l'overlay (durable, visible en direct pour tous) ;
    // sinon, mutation optimiste locale seulement (non publiée).
    if (supabaseEnabled) {
      setSave({ s: "saving" });
      try {
        await upsertJobOverride(id, patch);
        invalidateJobOverrides();
        onMutate(id, patch);
        setSave({ s: "ok" });
        notifyJobsChanged();
      } catch (err) {
        setSave({ s: "err", msg: (err as Error).message });
      }
      setTimeout(() => setSave(undefined), 2500);
      return;
    }
    onMutate(id, patch);
    setSave({ s: "local" });
    setTimeout(() => setSave(undefined), 4000);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full cursor-pointer items-baseline justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-left hover:bg-slate-100"
        title="Cliquer pour éditer cette offre"
      >
        <span className="truncate text-brand-700">{o.title || "(sans titre)"}</span>
        <span className="shrink-0 text-slate-400">
          {o.city ?? ""}{o.postedAt ? `${o.city ? " · " : ""}${relTime(o.postedAt)}` : ""}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 px-4 py-6">
          <button
            type="button"
            aria-label="Fermer l'éditeur d'offre"
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`offer-edit-title-${o.id}`}
            className="relative mt-4 w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-0 text-left shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-700">
              <h2 id={`offer-edit-title-${o.id}`} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Éditer l’offre
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Fermer ✕
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto p-4">
              <AdminOfferEditor
                offer={o}
                persistEnabled={persistEnabled && (mode !== "static" || supabaseEnabled)}
                save={save}
                onSave={doSave}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
