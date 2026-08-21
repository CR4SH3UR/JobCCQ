"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DISCOVERED_EMPLOYERS, type DiscoveredMethod } from "@jobccq/shared";
import { API_URL, getStats } from "@/lib/data";
import { Badge } from "./Badge";

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

const METHODS: DiscoveredMethod[] = [
  "html", "jsonld", "zoho", "bamboohr", "greenhouse", "lever",
  "recruitee", "smartrecruiters", "teamtailor", "ultipro", "jobillico",
];
const PAGE_SIZE = 40;
const LS_EDITS = "admin:edits";
const LS_VERIF = "admin:verified";
const LS_TOKEN = "admin:ghtoken";
const LS_TURSO_URL = "admin:tursourl";
const LS_TURSO_TOKEN = "admin:tursotoken";
const LS_SEARCH = "admin:search";
const LS_FILTER = "admin:filter";
const LS_SORT = "admin:sort";
const LS_METHOD = "admin:method";
const DISCOVERED_PATH = "packages/shared/src/discovered.json";

/** Filtres du tableau (persistés dans le navigateur → survivent au rafraîchissement). */
const FILTER_KEYS = ["all", "unverified", "verified", "nojobs", "disabled", "duplicates"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
/** Tri du tableau. */
const SORT_KEYS = ["name", "jobsDesc", "jobsAsc", "method", "region"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const SORT_LABELS: Record<SortKey, string> = {
  name: "Nom (A→Z)",
  jobsDesc: "Offres (plus→moins)",
  jobsAsc: "Offres (moins→plus)",
  method: "Méthode",
  region: "Région",
};

/** Lecture directe (hors state React) d'une clé localStorage. */
function readLS(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Compte d'offres par source, lu EN DIRECT dans Turso (une requête groupée). */
async function tursoCounts(url: string, token: string): Promise<Record<string, number>> {
  const rows = await tursoRows(url, token, "SELECT sourceId, COUNT(*) AS n FROM Job GROUP BY sourceId");
  const m: Record<string, number> = {};
  for (const r of rows) m[String(r.sourceId)] = Number(r.n);
  return m;
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
  const [ghToken, setGhToken] = useState("");
  const [ghOpen, setGhOpen] = useState(false);
  const [tursoUrl, setTursoUrl] = useState("");
  const [tursoToken, setTursoToken] = useState("");
  const [stale, setStale] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [sort, setSort] = useState<SortKey>("name");
  const [methodFilter, setMethodFilter] = useState<"all" | DiscoveredMethod>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<{ id: string; name: string; careersUrl: string; homepage: string; method: DiscoveredMethod; region: string }>(
    { id: "", name: "", careersUrl: "", homepage: "", method: "html", region: "" },
  );
  const [bulkMsg, setBulkMsg] = useState("");
  const latestRef = useRef<Employer[] | null>(null);

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

  // Édition locale (mode statique) : superposée aux données du paquet partagé.
  const editsRef = useRef<Record<string, Partial<Employer>>>({});

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    fetch(`${API_URL}/admin/employers`, { signal: ctrl.signal })
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

  // (Re)charge les compteurs dès que le mode est connu (Turso → base ; sinon
  // instantané). Rejoué si le mode change (ex. bascule statique → Turso).
  useEffect(() => {
    if (mode !== "loading") refreshCounts();
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
        const d = await fetch(`${API_URL}/admin/employers`).then((r) => r.json()).catch(() => null);
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
      latestRef.current = null;
      setStale(false);
    } finally {
      setReloading(false);
    }
  };

  const patchEmployer = async (id: string, patch: Partial<Employer>) => {
    setEmployers((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    if (mode === "api") {
      await fetch(`${API_URL}/admin/employers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).catch(() => {});
    } else if (mode === "turso") {
      // Écriture directe dans la table Employer (base partagée), en direct.
      const cols: string[] = [];
      const args: unknown[] = [];
      for (const k of ["name", "careersUrl", "method", "homepage", "region", "scope"] as const) {
        if (k in patch) {
          cols.push(`${k}=?`);
          args.push((patch as Record<string, unknown>)[k]);
        }
      }
      if ("verified" in patch) {
        cols.push("verified=?");
        args.push(patch.verified ? 1 : 0);
      }
      if ("enabled" in patch) {
        cols.push("enabled=?");
        args.push(patch.enabled === false ? 0 : 1);
      }
      if (cols.length) {
        cols.push("updatedAt=?");
        args.push(new Date().toISOString());
        args.push(id);
        await tursoRows(tursoUrl, tursoToken, `UPDATE Employer SET ${cols.join(",")} WHERE id=?`, args).catch(
          () => {},
        );
      }
    } else {
      editsRef.current[id] = { ...editsRef.current[id], ...patch };
      saveLS(LS_EDITS, editsRef.current);
      const verified = new Set(loadLS<string[]>(LS_VERIF, []));
      if ("verified" in patch) {
        patch.verified ? verified.add(id) : verified.delete(id);
        saveLS(LS_VERIF, [...verified]);
      }
    }
  };

  const rescrape = async (id: string) => {
    if (mode !== "api") return;
    setScrapes((s) => ({ ...s, [id]: { status: "run" } }));
    try {
      const r = await fetch(`${API_URL}/admin/employers/${id}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPages: 2 }),
      });
      const d = await r.json();
      if (d.report?.status === "success") {
        setScrapes((s) => ({ ...s, [id]: { status: "ok", found: d.report.found, sample: d.sample } }));
        // Le scrape a écrit en base : on rafraîchit le compteur sans recharger.
        refreshCounts();
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
      await fetch(`${API_URL}/admin/employers/${id}/offers`, { method: "DELETE" }).catch(() => {});
    }
    setCounts((c) => ({ ...c, [id]: 0 }));
  };

  const publishChanges = async () => {
    setPublish({ status: "run" });
    try {
      const r = await fetch(`${API_URL}/admin/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await r.json();
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
            setScrapes((s) => ({
              ...s,
              [id]:
                r.status === "error"
                  ? { status: "err", error: String(r.error ?? "échec du scrape") }
                  : { status: "ok", found: n, error: "updated" },
            }));
            pendingRef.current.delete(id);
          }
        }
        // Garde-fou : sources dont la fenêtre est écoulée (exécution morte/bloquée).
        for (const [id, info] of [...pendingRef.current]) {
          if (Date.now() > info.deadline) pendingRef.current.delete(id);
        }
      }
    } finally {
      pollingRef.current = false;
    }
  };

  // Ajoute une source re-scrapée à la file suivie et (re)lance la boucle unique.
  const queuePoll = (sourceId: string) => {
    pendingRef.current.set(sourceId, { deadline: Date.now() + 180_000 });
    void runPollLoop();
  };

  // --- Mode statique : agir sur GitHub via le jeton personnel du navigateur ---
  const ghScrape = async (sourceId: string) => {
    const { owner, repo } = ghRepo();
    setScrapes((s) => ({ ...s, [sourceId]: { status: "run" } }));
    try {
      const r = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/scrape.yml/dispatches`,
        { method: "POST", headers: GH_HEADERS(ghToken), body: JSON.stringify({ ref: "main", inputs: { sourceId, maxPages: "2" } }) },
      );
      if (r.status === 204) {
        setScrapes((s) => ({ ...s, [sourceId]: { status: "ok", error: "launched" } }));
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

  const ghPublish = async () => {
    const { owner, repo } = ghRepo();
    const base = `https://api.github.com/repos/${owner}/${repo}/contents/${DISCOVERED_PATH}`;
    setPublish({ status: "run" });
    try {
      // Repart TOUJOURS du fichier committé le plus récent (préserve rbq/sectors).
      const latest = await fetchLatestDiscovered();
      const merged = mergeForPublish(latest);
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
        setPublish({ status: "ok", message: "Publié sur GitHub — le site va se redéployer." });
      } else {
        const d = await r.json().catch(() => ({}));
        setPublish({ status: "err", message: d.message ?? `HTTP ${r.status}` });
      }
    } catch (e) {
      setPublish({ status: "err", message: (e as Error).message });
    }
  };

  // URLs de carrières utilisées par PLUSIEURS employeurs (doublons, ex. Canam).
  const dupUrls = useMemo(() => {
    const seen = new Map<string, number>();
    for (const e of employers) {
      const u = e.careersUrl.trim().replace(/\/+$/, "").toLowerCase();
      if (u) seen.set(u, (seen.get(u) ?? 0) + 1);
    }
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([u]) => u));
  }, [employers]);
  const isDup = (e: Employer) => dupUrls.has(e.careersUrl.trim().replace(/\/+$/, "").toLowerCase());

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
      else await fetch(`${API_URL}/admin/employers/${id}/offers`, { method: "DELETE" }).catch(() => {});
    }
    setCounts((c) => {
      const n = { ...c };
      for (const id of withJobs) n[id] = 0;
      return n;
    });
    setBulkMsg(`Offres vidées pour ${withJobs.length} employeur(s).`);
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
      await fetch(`${API_URL}/admin/employers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(emp) }).catch(() => {});
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
      await fetch(`${API_URL}/admin/employers/${id}`, { method: "DELETE" }).catch(() => {});
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
      if (methodFilter !== "all" && e.method !== methodFilter) return false;
      if (!q) return true;
      return (e.name + " " + e.careersUrl + " " + e.homepage + " " + e.method + " " + (e.region ?? ""))
        .toLowerCase()
        .includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employers, search, filter, methodFilter, counts, dupUrls]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const byName = (a: Employer, b: Employer) => a.name.localeCompare(b.name, "fr");
    if (sort === "jobsDesc") arr.sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0) || byName(a, b));
    else if (sort === "jobsAsc") arr.sort((a, b) => (counts[a.id] ?? 0) - (counts[b.id] ?? 0) || byName(a, b));
    else if (sort === "method") arr.sort((a, b) => a.method.localeCompare(b.method) || byName(a, b));
    else if (sort === "region") arr.sort((a, b) => (a.region ?? "").localeCompare(b.region ?? "") || byName(a, b));
    else arr.sort(byName);
    return arr;
  }, [filtered, sort, counts]);

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["id", "nom", "methode", "region", "offres", "verifie", "actif", "url"].join(",")];
    for (const e of sorted)
      lines.push(
        [e.id, e.name, e.method, e.region ?? "", counts[e.id] ?? 0, e.verified ? "oui" : "non", e.enabled === false ? "non" : "oui", e.careersUrl]
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
  const totalOffers = employers.reduce((s, e) => s + (counts[e.id] ?? 0), 0);
  const scrapeEnabled = mode === "api" || !!ghToken;
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageIds = pageItems.map((e) => e.id);
  const selectedList = [...selected];
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  useEffect(() => setPage(1), [search, filter, methodFilter, sort]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Administration des sources</h1>
        <p className="mt-1 text-sm text-slate-600">
          Vérifie, corrige les URLs et relance le scraping site par site.
        </p>
      </header>

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
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  ✅ <strong>Mode Turso</strong> — éditions et vérifications enregistrées <strong>en direct</strong> dans la base partagée.
                </span>
                {ghToken ? (
                  <button
                    onClick={ghTriggerDeploy}
                    disabled={publish.status === "run"}
                    className="rounded-lg bg-green-700 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {publish.status === "run" ? "Reconstruction…" : "🔁 Reconstruire le site"}
                  </button>
                ) : (
                  <span className="text-green-700">Le site se reconstruira au prochain déploiement.</span>
                )}
                {publish.status !== "idle" && publish.status !== "run" && (
                  <span className={publish.status === "ok" ? "text-green-700" : "text-red-600"}>{publish.message}</span>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <span>
                  ⚠️ <strong>Mode lecture</strong> (API non détectée). Connecte un jeton GitHub pour <strong>scraper</strong> et
                  <strong> publier</strong> directement depuis cette page, ou lance l'API en local (<code>npm run dev:api</code>).
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => setGhOpen((v) => !v)} className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-amber-100">
                    {ghToken ? "🔑 GitHub connecté" : "🔗 Connecter GitHub"}
                  </button>
                  {ghToken && (
                    <button onClick={ghPublish} disabled={publish.status === "run"} className="rounded-lg bg-green-700 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">
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
                {ghOpen && (
                  <div className="rounded-lg border border-amber-300 bg-white p-2 text-xs text-slate-700">
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
          <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[
              { label: "Employeurs", value: employers.length, f: "all" as FilterKey },
              { label: "Offres", value: totalOffers, f: null },
              { label: "Vérifiés", value: verifiedCount, f: "verified" as FilterKey },
              { label: "Désactivés", value: disabledCount, f: "disabled" as FilterKey },
              { label: "Sans offres", value: noJobsCount, f: "nojobs" as FilterKey },
              { label: "Doublons", value: dupCount, f: "duplicates" as FilterKey },
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
                <option value="nojobs">Sans offres ({noJobsCount})</option>
                <option value="disabled">Désactivées ({disabledCount})</option>
                <option value="duplicates">Doublons ({dupCount})</option>
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
                <input placeholder="Région (optionnel)" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} className="rounded border border-slate-300 px-2 py-1 text-xs" />
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
              {(mode === "turso" || mode === "api") && (
                <button onClick={() => bulkPurge(selectedList)} className="rounded-lg border border-red-300 bg-white px-2.5 py-1 font-semibold text-red-600 hover:bg-red-50">
                  🗑 Vider les offres
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
                onToggleSelect={toggleSelect}
                onPatch={patchEmployer}
                onScrape={scrapeOne}
                onPurge={purgeOffers}
                onDelete={deleteEmployer}
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

function Row({
  e, count, scrape, scrapeEnabled, purgeEnabled, deleteEnabled, selected, duplicate, onToggleSelect, onPatch, onScrape, onPurge, onDelete,
}: {
  e: Employer;
  count: number;
  scrape?: ScrapeState;
  scrapeEnabled: boolean;
  purgeEnabled: boolean;
  deleteEnabled: boolean;
  selected: boolean;
  duplicate: boolean;
  onToggleSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<Employer>) => void;
  onScrape: (id: string) => void;
  onPurge: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [url, setUrl] = useState(e.careersUrl);
  const [name, setName] = useState(e.name);
  useEffect(() => { setUrl(e.careersUrl); setName(e.name); }, [e.careersUrl, e.name]);

  const dirty = url !== e.careersUrl || name !== e.name;

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
          <span
            title="Plusieurs employeurs partagent cette même URL de carrières"
            className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700"
          >
            ⚠ doublon
          </span>
        )}
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
        <button
          disabled={!dirty}
          onClick={() => onPatch(e.id, { careersUrl: url.trim(), name: name.trim() })}
          className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-30"
        >
          Enregistrer
        </button>
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

      {scrape && scrape.status !== "run" && (
        <div className="mt-2 text-xs">
          {scrape.status === "ok" && scrape.error === "launched" ? (
            <span className="text-green-700">🚀 Scraping lancé sur GitHub — le compteur se mettra à jour tout seul dans ~1 min (sans recharger).</span>
          ) : scrape.status === "ok" && scrape.error === "updated" ? (
            <span className="text-green-700">
              ✅ Compteur à jour : {scrape.found} offre{(scrape.found ?? 0) > 1 ? "s" : ""} (base rafraîchie, sans recharger).
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
