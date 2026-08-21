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
const DISCOVERED_PATH = "packages/shared/src/discovered.json";

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
  const [filter, setFilter] = useState<"all" | "unverified" | "verified" | "nojobs" | "disabled">("all");
  const [page, setPage] = useState(1);
  const [scrapes, setScrapes] = useState<Record<string, ScrapeState>>({});
  const [publish, setPublish] = useState<{ status: "idle" | "run" | "ok" | "err"; message?: string }>({ status: "idle" });
  const [ghToken, setGhToken] = useState("");
  const [ghOpen, setGhOpen] = useState(false);
  const [tursoUrl, setTursoUrl] = useState("");
  const [tursoToken, setTursoToken] = useState("");
  const [stale, setStale] = useState(false);
  const [reloading, setReloading] = useState(false);
  const latestRef = useRef<Employer[] | null>(null);

  useEffect(() => {
    try {
      setGhToken(localStorage.getItem(LS_TOKEN) ?? "");
      setTursoUrl(localStorage.getItem(LS_TURSO_URL) ?? "");
      setTursoToken(localStorage.getItem(LS_TURSO_TOKEN) ?? "");
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

  // Nombre d'offres par compagnie (depuis l'instantané, mode statique ou connecté).
  useEffect(() => {
    getStats()
      .then((s) => {
        const m: Record<string, number> = {};
        for (const x of s.bySource) m[x.id] = x.count;
        setCounts(m);
      })
      .catch(() => {});
  }, []);

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
      const s = await getStats().catch(() => null);
      if (s) {
        const m: Record<string, number> = {};
        for (const x of s.bySource) m[x.id] = x.count;
        setCounts(m);
      }
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
      } else {
        setScrapes((s) => ({ ...s, [id]: { status: "err", error: d.report?.error ?? "échec" } }));
      }
    } catch (e) {
      setScrapes((s) => ({ ...s, [id]: { status: "err", error: (e as Error).message } }));
    }
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employers.filter((e) => {
      if (filter === "verified" && !e.verified) return false;
      if (filter === "unverified" && e.verified) return false;
      if (filter === "nojobs" && (counts[e.id] ?? 0) > 0) return false;
      if (filter === "disabled" && e.enabled !== false) return false;
      if (!q) return true;
      return (e.name + " " + e.careersUrl + " " + e.homepage + " " + e.method + " " + (e.region ?? ""))
        .toLowerCase()
        .includes(q);
    });
  }, [employers, search, filter, counts]);

  const verifiedCount = employers.filter((e) => e.verified).length;
  const noJobsCount = employers.filter((e) => (counts[e.id] ?? 0) === 0).length;
  const disabledCount = employers.filter((e) => e.enabled === false).length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [search, filter]);

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

          <div className="card mb-4 flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (nom, URL, méthode, région)…"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            >
              <option value="all">Tous ({employers.length})</option>
              <option value="unverified">À vérifier ({employers.length - verifiedCount})</option>
              <option value="verified">Vérifiés ({verifiedCount})</option>
              <option value="nojobs">Sans offres ({noJobsCount})</option>
              <option value="disabled">Désactivées ({disabledCount})</option>
            </select>
            <button
              onClick={reloadData}
              disabled={reloading}
              title="Récupérer la dernière version des données"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
            >
              {reloading ? "Rechargement…" : "🔄 Recharger"}
            </button>
            {mode === "static" && (
              <button onClick={exportJson} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-100">
                Exporter
              </button>
            )}
          </div>

          <p className="mb-2 text-sm text-slate-500">
            {filtered.length} résultat{filtered.length > 1 ? "s" : ""} · vérifiés {verifiedCount}/{employers.length}
          </p>

          <div className="space-y-2">
            {pageItems.map((e) => (
              <Row
                key={e.id}
                e={e}
                count={counts[e.id] ?? 0}
                scrape={scrapes[e.id]}
                scrapeEnabled={mode === "api" || !!ghToken}
                onPatch={patchEmployer}
                onScrape={mode === "api" ? rescrape : ghScrape}
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
  e, count, scrape, scrapeEnabled, onPatch, onScrape,
}: {
  e: Employer;
  count: number;
  scrape?: ScrapeState;
  scrapeEnabled: boolean;
  onPatch: (id: string, patch: Partial<Employer>) => void;
  onScrape: (id: string) => void;
}) {
  const [url, setUrl] = useState(e.careersUrl);
  const [name, setName] = useState(e.name);
  useEffect(() => { setUrl(e.careersUrl); setName(e.name); }, [e.careersUrl, e.name]);

  const dirty = url !== e.careersUrl || name !== e.name;

  const disabled = e.enabled === false;
  return (
    <article
      className={`card p-3 ${disabled ? "opacity-60" : ""} ${
        disabled ? "ring-1 ring-red-300" : e.verified ? "ring-1 ring-green-300" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
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
      </div>

      {scrape && scrape.status !== "run" && (
        <div className="mt-2 text-xs">
          {scrape.status === "ok" && scrape.error === "launched" ? (
            <span className="text-green-700">🚀 Scraping lancé sur GitHub — voir l'onglet « Actions » (résultat en ligne dans ~1 min).</span>
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
