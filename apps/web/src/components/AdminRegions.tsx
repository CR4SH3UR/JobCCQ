"use client";

import { useEffect, useMemo, useState } from "react";
import { MUNICIPALITIES, QUEBEC_REGIONS, type Municipality } from "@jobccq/shared";

/**
 * Éditeur **municipalités → région** (console d'administration).
 *
 * Édite `packages/shared/src/municipalities.json` : associe une municipalité
 * (ville) à l'une des 17 régions administratives. « Publier » écrit le fichier
 * sur GitHub (même mécanisme que les sponsors) → redéploiement. À l'export,
 * toute offre située dans une de ces villes est reclassée dans la bonne région,
 * offres existantes comprises. Aucun serveur d'API requis : réutilise le jeton
 * GitHub déjà saisi dans le panneau principal (localStorage).
 */
const LS_TOKEN = "admin:ghtoken";
const PATH = "packages/shared/src/municipalities.json";

// Seules les vraies régions administratives peuvent recevoir une municipalité
// (télétravail / hors-Québec / non précisé n'ont pas de villes à mapper).
const REGION_OPTIONS = QUEBEC_REGIONS.filter(
  (r) => !["teletravail", "canada-autre", "autre"].includes(r.id),
);
const REGION_LABEL: Record<string, string> = Object.fromEntries(
  QUEBEC_REGIONS.map((r) => [r.id, r.label]),
);

function ghRepo(): { owner: string; repo: string } {
  try {
    const host = location.hostname.split(".")[0];
    const seg = location.pathname.split("/").filter(Boolean)[0];
    if (location.hostname.endsWith("github.io") && host && seg) return { owner: host, repo: seg };
  } catch {
    /* SSR */
  }
  return { owner: "CR4SH3UR", repo: "JobCCQ" };
}

const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

function b64utf8(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

function readToken(): string {
  try {
    return localStorage.getItem(LS_TOKEN) ?? "";
  } catch {
    return "";
  }
}

type Status = { k: "idle" | "run" | "ok" | "err"; msg?: string };

export function AdminRegions() {
  const [items, setItems] = useState<Municipality[]>([...MUNICIPALITIES]);
  const [name, setName] = useState("");
  const [regionId, setRegionId] = useState<string>(REGION_OPTIONS[0]!.id);
  const [status, setStatus] = useState<Status>({ k: "idle" });

  // Charge la version la plus récente committée (évite de repartir d'un bundle périmé).
  useEffect(() => {
    const { owner, repo } = ghRepo();
    (async () => {
      try {
        const r = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/main/${PATH}?t=${Date.now()}`,
          { cache: "no-store" },
        );
        if (r.ok) {
          const d = (await r.json()) as Municipality[];
          if (Array.isArray(d)) setItems(d);
        }
      } catch {
        /* garde le bundle */
      }
    })();
  }, []);

  // Regroupe les municipalités par région (régions non vides seulement, triées).
  const grouped = useMemo(() => {
    const byRegion = new Map<string, string[]>();
    for (const m of items) {
      if (!m?.name || !m?.regionId) continue;
      const arr = byRegion.get(m.regionId) ?? [];
      arr.push(m.name);
      byRegion.set(m.regionId, arr);
    }
    return REGION_OPTIONS.map((r) => ({
      id: r.id,
      label: r.label,
      cities: (byRegion.get(r.id) ?? []).sort((a, b) => a.localeCompare(b, "fr")),
    })).filter((g) => g.cities.length > 0);
  }, [items]);

  const add = () => {
    const n = name.trim();
    if (!n) return;
    const key = n.toLowerCase();
    setItems((list) => [
      ...list.filter((m) => m.name.trim().toLowerCase() !== key),
      { name: n, regionId },
    ]);
    setName("");
    setStatus({ k: "idle", msg: `Ajouté : « ${n} » → ${REGION_LABEL[regionId] ?? regionId}. Pense à publier.` });
  };

  const remove = (city: string) => {
    setItems((list) => list.filter((m) => m.name !== city));
    setStatus({ k: "idle", msg: `Retiré : « ${city} ». Pense à publier.` });
  };

  const publish = async () => {
    const token = readToken();
    if (!token) {
      setStatus({ k: "err", msg: "Connecte d'abord GitHub (panneau « Connecter GitHub » plus haut)." });
      return;
    }
    const { owner, repo } = ghRepo();
    const base = `https://api.github.com/repos/${owner}/${repo}/contents/${PATH}`;
    setStatus({ k: "run" });
    try {
      const clean = items
        .filter((m) => m.name.trim() && m.regionId)
        .map((m) => ({ name: m.name.trim(), regionId: m.regionId }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr"));
      const cur = await fetch(`${base}?ref=main`, { headers: GH_HEADERS(token) });
      const sha = cur.ok ? (await cur.json()).sha : undefined;
      const body = {
        message: "Admin : mise à jour des municipalités → régions",
        content: b64utf8(JSON.stringify(clean, null, 2) + "\n"),
        branch: "main",
        ...(sha ? { sha } : {}),
      };
      const r = await fetch(base, { method: "PUT", headers: GH_HEADERS(token), body: JSON.stringify(body) });
      if (r.ok) {
        setStatus({ k: "ok", msg: "✅ Publié — le site va se redéployer et reclasser les offres (quelques minutes)." });
      } else {
        const d = await r.json().catch(() => ({}));
        setStatus({ k: "err", msg: (d as { message?: string }).message ?? `HTTP ${r.status}` });
      }
    } catch (e) {
      setStatus({ k: "err", msg: (e as Error).message });
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10">
      <div className="card p-4">
        <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">
          🗺️ Municipalités &amp; régions
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Associez une municipalité à sa région administrative, puis <strong>publiez</strong>. Toute
          offre située dans cette ville sera classée dans la bonne région au prochain déploiement
          (offres existantes comprises).
        </p>

        {/* Formulaire d'ajout */}
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[14rem] flex-1">
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Municipalité (ville)
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="ex. Saint-Jérôme"
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div className="min-w-[14rem]">
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Région
            </label>
            <select
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              {REGION_OPTIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={add}
            disabled={!name.trim()}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-400 dark:text-slate-950 dark:hover:bg-brand-300"
          >
            + Ajouter
          </button>
        </div>

        {/* Liste groupée par région */}
        <div className="mt-6">
          {grouped.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Aucune municipalité enregistrée pour l'instant.
            </p>
          ) : (
            <div className="space-y-4">
              {grouped.map((g) => (
                <div key={g.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <h3 className="mb-2 text-sm font-bold text-brand-700 dark:text-brand-300">
                    {g.label} <span className="font-normal text-slate-400">({g.cities.length})</span>
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {g.cities.map((city) => (
                      <span
                        key={city}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600"
                      >
                        {city}
                        <button
                          onClick={() => remove(city)}
                          aria-label={`Retirer ${city}`}
                          className="text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Publier */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
          <button
            onClick={publish}
            disabled={status.k === "run"}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-brand-400 dark:text-slate-950"
          >
            {status.k === "run" ? "Publication…" : "⬆ Publier les municipalités"}
          </button>
          {status.msg && (
            <span className={status.k === "err" ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}>
              {status.msg}
            </span>
          )}
          <span className="text-xs text-slate-400">Publie sur GitHub → redéploiement + reclassement automatiques.</span>
        </div>
      </div>
    </div>
  );
}
