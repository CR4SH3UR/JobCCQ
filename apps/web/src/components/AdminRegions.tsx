"use client";

import { useEffect, useMemo, useState } from "react";
import { QUEBEC_REGIONS, type Municipality } from "@jobccq/shared";
import {
  fetchMunicipalities,
  upsertMunicipality,
  deleteMunicipality,
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

export function AdminRegions() {
  const [items, setItems] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [regionId, setRegionId] = useState<string>(REGION_OPTIONS[0]!.id);
  const [status, setStatus] = useState<Status>({ k: "idle" });

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

        {/* Liste groupée par région */}
        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Chargement…</p>
          ) : grouped.length === 0 ? (
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
                          onClick={() => void remove(city)}
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
