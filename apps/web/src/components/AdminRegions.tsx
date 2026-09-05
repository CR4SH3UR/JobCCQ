"use client";

import { useEffect, useMemo, useState } from "react";
import { QUEBEC_REGIONS, type Municipality } from "@jobccq/shared";
import {
  fetchMunicipalities,
  upsertMunicipality,
  deleteMunicipality,
  importOfficialMunicipalities,
} from "@/lib/municipalities";

/**
 * Éditeur **municipalités → région** (console d'administration).
 *
 * Écrit **en direct dans Supabase** (table `municipalities`). Toute modification
 * s'applique **immédiatement, sans republier** : le site lit la table au
 * chargement et reclasse les offres côté navigateur. L'écriture est réservée aux
 * admins (RLS Supabase sur le courriel du compte).
 */

// Seules les vraies régions administratives peuvent recevoir une municipalité
// (télétravail / hors-Québec / non précisé n'ont pas de villes à mapper).
const REGION_OPTIONS = QUEBEC_REGIONS.filter(
  (r) => !["teletravail", "canada-autre", "autre"].includes(r.id),
);
const REGION_LABEL: Record<string, string> = Object.fromEntries(
  QUEBEC_REGIONS.map((r) => [r.id, r.label]),
);

type Status = { k: "idle" | "run" | "ok" | "err"; msg?: string };

/** Repli des accents/casse pour une recherche tolérante (« montreal » = « Montréal »). */
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function AdminRegions() {
  const [items, setItems] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [regionId, setRegionId] = useState<string>(REGION_OPTIONS[0]!.id);
  const [status, setStatus] = useState<Status>({ k: "idle" });
  const [importing, setImporting] = useState(false);
  // Recherche + filtre + repli des sections.
  const [query, setQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      setItems(await fetchMunicipalities());
    } catch (e) {
      setStatus({ k: "err", msg: `Chargement impossible : ${(e as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = useMemo(
    () => items.filter((m) => m?.name && m?.regionId).length,
    [items],
  );

  // Regroupe par région, en appliquant recherche + filtre région. Régions non
  // vides seulement, villes triées. `matches` = total après filtrage.
  const { grouped, matches } = useMemo(() => {
    const q = fold(query);
    const byRegion = new Map<string, string[]>();
    for (const m of items) {
      if (!m?.name || !m?.regionId) continue;
      if (regionFilter !== "all" && m.regionId !== regionFilter) continue;
      if (q && !fold(m.name).includes(q)) continue;
      const arr = byRegion.get(m.regionId) ?? [];
      arr.push(m.name);
      byRegion.set(m.regionId, arr);
    }
    let matches = 0;
    const grouped = REGION_OPTIONS.map((r) => {
      const cities = (byRegion.get(r.id) ?? []).sort((a, b) => a.localeCompare(b, "fr"));
      matches += cities.length;
      return { id: r.id, label: r.label, cities };
    }).filter((g) => g.cities.length > 0);
    return { grouped, matches };
  }, [items, query, regionFilter]);

  // Pendant une recherche, tout est déplié pour voir les résultats d'emblée.
  const searching = query.trim().length > 0;
  const isOpen = (id: string) => searching || open.has(id);
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const openAll = () => setOpen(new Set(grouped.map((g) => g.id)));
  const collapseAll = () => setOpen(new Set());

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    setStatus({ k: "run" });
    try {
      await upsertMunicipality(n, regionId);
      setName("");
      setStatus({ k: "ok", msg: `✅ « ${n} » → ${REGION_LABEL[regionId] ?? regionId} (appliqué en direct)` });
      await load();
    } catch (e) {
      setStatus({ k: "err", msg: writeError(e) });
    }
  };

  const remove = async (city: string) => {
    setStatus({ k: "run" });
    try {
      await deleteMunicipality(city);
      setStatus({ k: "ok", msg: `🗑️ « ${city} » retirée (appliqué en direct)` });
      await load();
    } catch (e) {
      setStatus({ k: "err", msg: writeError(e) });
    }
  };

  const importAll = async () => {
    setImporting(true);
    setStatus({ k: "run", msg: "Import des municipalités officielles en cours..." });
    try {
      const result = await importOfficialMunicipalities();
      const alias = result.aliases ? ` + ${result.aliases} localités/secteurs` : "";
      setStatus({
        k: "ok",
        msg: `${result.imported} municipalités importées depuis le MAMH${alias}${
          result.skipped ? ` (${result.skipped} ligne(s) ignorée(s))` : ""
        }.`,
      });
      await load();
    } catch (e) {
      setStatus({ k: "err", msg: writeError(e) });
    } finally {
      setImporting(false);
    }
  };

  const inputCls =
    "w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white";

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10">
      <div className="card p-4">
        <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">
          🗺️ Municipalités &amp; régions
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Associez une municipalité à sa région administrative. Les changements sont
          <strong> appliqués en direct, sans republier</strong> : toute offre située dans cette
          ville passe dans la bonne région dès le prochain chargement du site (offres existantes
          comprises).
        </p>

        {/* Import officiel MAMH */}
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-500/30 dark:bg-sky-950/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Import officiel MAMH
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Remplit la table avec toutes les municipalités du Québec, plus les localités et
                secteurs courants (anciennes villes fusionnées, arrondissements de Montréal,
                secteurs de Laval…), classés par région.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void importAll()}
              disabled={importing}
              className="rounded-lg bg-sky-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300"
            >
              {importing ? "Import..." : "Importer tout"}
            </button>
          </div>
        </div>

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
                  void add();
                }
              }}
              placeholder="ex. Saint-Jérôme"
              className={inputCls}
            />
          </div>
          <div className="min-w-[14rem]">
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Région
            </label>
            <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className={inputCls}>
              {REGION_OPTIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => void add()}
            disabled={status.k === "run" || !name.trim()}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-400 dark:text-slate-950 dark:hover:bg-brand-300"
          >
            + Ajouter
          </button>
        </div>
        {status.msg && (
          <p className={`mt-2 text-sm ${status.k === "err" ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
            {status.msg}
          </p>
        )}

        {/* Barre de recherche + filtre région */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[16rem] flex-1">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une municipalité…"
              className={`${inputCls} pl-8`}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="min-w-[12rem] rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">Toutes les régions</option>
            {REGION_OPTIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          {!searching && grouped.length > 0 && (
            <div className="flex gap-1 text-xs">
              <button
                type="button"
                onClick={openAll}
                className="rounded border border-slate-300 px-2 py-1 font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Tout déplier
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="rounded border border-slate-300 px-2 py-1 font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Tout replier
              </button>
            </div>
          )}
        </div>

        {/* Compteur */}
        {!loading && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {searching || regionFilter !== "all"
              ? `${matches} résultat${matches > 1 ? "s" : ""} sur ${total} municipalité${total > 1 ? "s" : ""}`
              : `${total} municipalité${total > 1 ? "s" : ""} dans ${grouped.length} région${grouped.length > 1 ? "s" : ""}`}
          </p>
        )}

        {/* Liste groupée par région (repliable) */}
        <div className="mt-3">
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Chargement…</p>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {total === 0
                ? "Aucune municipalité enregistrée. Lancez « Importer tout » pour remplir la table."
                : "Aucun résultat pour cette recherche."}
            </p>
          ) : (
            <div className="space-y-2">
              {grouped.map((g) => (
                <div key={g.id} className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => toggle(g.id)}
                    className="flex w-full items-center justify-between gap-2 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                  >
                    <span className="text-sm font-bold text-brand-700 dark:text-brand-300">
                      {g.label} <span className="font-normal text-slate-400">({g.cities.length})</span>
                    </span>
                    <span className="text-slate-400">{isOpen(g.id) ? "▾" : "▸"}</span>
                  </button>
                  {isOpen(g.id) && (
                    <div className="flex flex-wrap gap-1.5 p-3">
                      {g.cities.map((city) => (
                        <span
                          key={city}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600"
                        >
                          {city}
                          <button
                            onClick={() => void remove(city)}
                            aria-label={`Retirer ${city}`}
                            className="text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-6 border-t border-slate-200 pt-3 text-xs text-slate-400 dark:border-slate-700">
          Stocké dans Supabase (table <code>municipalities</code>). Écriture réservée aux admins ;
          lecture publique pour le reclassement en direct.
        </p>
      </div>
    </div>
  );
}

/** Message d'erreur d'écriture plus parlant (RLS / table absente / non connecté). */
function writeError(e: unknown): string {
  const msg = (e as Error).message ?? "Erreur inconnue";
  if (/row-level security|permission|denied|not authorized/i.test(msg)) {
    return "Écriture refusée : connecte-toi avec un compte admin (RLS Supabase).";
  }
  if (/relation .*municipalities.* does not exist|could not find the table/i.test(msg)) {
    return "La table « municipalities » n'existe pas encore dans Supabase (voir infra/README-supabase.md).";
  }
  return msg;
}
