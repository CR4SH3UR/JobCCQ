"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Job } from "@jobccq/shared";
import { searchJobs, buildQuery } from "@/lib/data";
import { JobCard } from "./JobCard";
import { useFavorites } from "@/lib/favorites";
import { useAuth } from "@/lib/auth";

/**
 * Page « Mes favoris » : les offres sauvegardées par le visiteur (stockées dans
 * son navigateur). On charge l'instantané complet une fois puis on filtre sur
 * les id favoris — un favori dont l'offre a disparu (poste comblé) n'apparaît
 * plus ; on le signale sans planter.
 */
export function FavorisView() {
  const favorites = useFavorites();
  const { user, enabled } = useAuth();
  const [allJobs, setAllJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    searchJobs(buildQuery({ pageSize: 100_000, sort: "recent" }))
      .then((r) => alive && setAllJobs(r.items))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const items = useMemo(
    () => (allJobs ? allJobs.filter((j) => favorites.has(j.id)) : []),
    [allJobs, favorites],
  );
  const missing = allJobs ? favorites.size - items.length : 0;

  return (
    <div>
      {enabled && (
        <div
          className={`card mb-4 p-3 text-sm ${
            user ? "border-green-200 bg-green-50 text-green-800" : "border-brand-200 bg-brand-50 text-brand-800"
          }`}
        >
          {user ? (
            <>✅ Favoris <strong>synchronisés</strong> sur tous tes appareils · {user.email}</>
          ) : (
            <>☁️ Connecte-toi (bouton <strong>« Se connecter »</strong> en haut) pour synchroniser tes favoris sur tous tes appareils. Sinon ils restent sur ce navigateur.</>
          )}
        </div>
      )}

      {error && (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Impossible de charger les offres : {error}
        </div>
      )}

      {!allJobs && !error && <p className="text-slate-500">Chargement…</p>}

      {allJobs && favorites.size === 0 && (
        <div className="card p-8 text-center text-slate-500">
          <div className="mb-2 text-3xl">♡</div>
          <p className="font-medium text-slate-700">Aucun favori pour l'instant</p>
          <p className="mt-1 text-sm">
            Parcours les offres et clique sur le cœur ♡ pour les sauvegarder ici. Tes favoris
            restent dans ce navigateur.
          </p>
          <Link
            href="/emplois"
            className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Voir les offres →
          </Link>
        </div>
      )}

      {allJobs && favorites.size > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{items.length}</span> offre
              {items.length > 1 ? "s" : ""} sauvegardée{items.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="space-y-3">
            {items.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
          {missing > 0 && (
            <p className="mt-4 text-center text-xs text-slate-400">
              {missing} favori{missing > 1 ? "s" : ""} n'{missing > 1 ? "apparaissent" : "apparaît"} plus
              (offre{missing > 1 ? "s" : ""} probablement comblée{missing > 1 ? "s" : ""} ou retirée{missing > 1 ? "s" : ""}).
            </p>
          )}
        </>
      )}
    </div>
  );
}
