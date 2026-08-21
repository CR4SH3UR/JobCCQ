"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DISCOVERED_EMPLOYERS, type DiscoveredMethod } from "@jobccq/shared";
import { API_URL } from "@/lib/data";
import { Badge } from "./Badge";

type Employer = {
  id: string;
  name: string;
  homepage: string;
  careersUrl: string;
  method: DiscoveredMethod;
  region?: string;
  scope?: string;
  sectors?: readonly string[];
  verified?: boolean;
};

type Mode = "loading" | "api" | "static";
type ScrapeState = { status: "run" | "ok" | "err"; found?: number; error?: string; sample?: { title: string; city?: string }[] };

const METHODS: DiscoveredMethod[] = [
  "html", "jsonld", "zoho", "bamboohr", "greenhouse", "lever",
  "recruitee", "smartrecruiters", "teamtailor", "ultipro", "jobillico",
];
const PAGE_SIZE = 40;
const LS_EDITS = "admin:edits";
const LS_VERIF = "admin:verified";

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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unverified" | "verified">("all");
  const [page, setPage] = useState(1);
  const [scrapes, setScrapes] = useState<Record<string, ScrapeState>>({});
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
      .catch(() => {
        if (!alive) return;
        clearTimeout(t);
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
      });
    return () => {
      alive = false;
    };
  }, []);

  const patchEmployer = async (id: string, patch: Partial<Employer>) => {
    setEmployers((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    if (mode === "api") {
      await fetch(`${API_URL}/admin/employers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).catch(() => {});
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

  const exportJson = () => {
    const clean = employers.map((e) => ({
      id: e.id, name: e.name, homepage: e.homepage, careersUrl: e.careersUrl,
      method: e.method, region: e.region, scope: e.scope, sectors: e.sectors,
      ...(e.verified ? { verified: true } : {}),
    }));
    const blob = new Blob([JSON.stringify(clean, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "discovered.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employers.filter((e) => {
      if (filter === "verified" && !e.verified) return false;
      if (filter === "unverified" && e.verified) return false;
      if (!q) return true;
      return (e.name + " " + e.careersUrl + " " + e.homepage + " " + e.method + " " + (e.region ?? ""))
        .toLowerCase()
        .includes(q);
    });
  }, [employers, search, filter]);

  const verifiedCount = employers.filter((e) => e.verified).length;
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
              mode === "api" ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {mode === "api" ? (
              <>✅ <strong>Mode connecté</strong> — édition, vérification et re-scraping sont enregistrés dans <code>discovered.json</code>.</>
            ) : (
              <>
                ⚠️ <strong>Mode lecture</strong> (API non détectée) — les modifications et cases cochées sont mémorisées dans
                ton navigateur. Lance l'API en local (<code>npm run dev:api</code>) pour éditer/scraper pour de vrai, ou utilise
                <button onClick={exportJson} className="mx-1 rounded bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">Exporter discovered.json</button>
                pour committer tes corrections.
              </>
            )}
          </div>

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
            </select>
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
                mode={mode}
                scrape={scrapes[e.id]}
                onPatch={patchEmployer}
                onRescrape={rescrape}
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
  e, mode, scrape, onPatch, onRescrape,
}: {
  e: Employer;
  mode: Mode;
  scrape?: ScrapeState;
  onPatch: (id: string, patch: Partial<Employer>) => void;
  onRescrape: (id: string) => void;
}) {
  const [url, setUrl] = useState(e.careersUrl);
  const [name, setName] = useState(e.name);
  useEffect(() => { setUrl(e.careersUrl); setName(e.name); }, [e.careersUrl, e.name]);

  const dirty = url !== e.careersUrl || name !== e.name;

  return (
    <article className={`card p-3 ${e.verified ? "ring-1 ring-green-300" : ""}`}>
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
        {mode === "api" && (
          <button
            onClick={() => onRescrape(e.id)}
            className="rounded-lg border border-brand-300 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
          >
            {scrape?.status === "run" ? "Scraping…" : "Re-scraper"}
          </button>
        )}
      </div>

      {scrape && scrape.status !== "run" && (
        <div className="mt-2 text-xs">
          {scrape.status === "ok" ? (
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
