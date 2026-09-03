"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Job } from "@jobccq/shared";
import { searchJobs, buildQuery } from "@/lib/data";
import { JobCard } from "./JobCard";
import { useApplications } from "@/lib/applications";

/**
 * Page « Mes candidatures » : les offres où la personne a marqué avoir postulé
 * (stockées dans son navigateur, synchronisées si connectée). On charge
 * l'instantané complet une fois puis on filtre sur les id marqués — une offre
 * disparue (poste comblé) n'apparaît plus ; on le signale sans planter.
 */
export function CandidaturesView() {
  const applied = useApplications();
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
    () => (allJobs ? allJobs.filter((j) => applied.has(j.id)) : []),
    [allJobs, applied],
  );
  const missing = allJobs ? applied.size - items.length : 0;

  return (
    <div>
      {error && (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Impossible de charger les offres : {error}
        </div>
      )}

      {!allJobs && !error && <p className="text-slate-500">Chargement…</p>}

      {allJobs && applied.size === 0 && (
        <div className="card p-8 text-center text-slate-500">
          <div className="mb-2 text-3xl text-green-500">✓</div>
          <p className="font-medium text-slate-700">Aucune candidature pour l'instant</p>
          <p className="mt-1 text-sm">
            Quand tu postules à une offre, clique sur <strong>« Marquer comme postulé »</strong> pour
            la retrouver ici et suivre où tu as envoyé ton CV.
          </p>
          <Link
            href="/emplois"
            className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Voir les offres →
          </Link>
        </div>
      )}

      {allJobs && applied.size > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{items.length}</span> candidature
              {items.length > 1 ? "s" : ""} suivie{items.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="space-y-3">
            {items.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
          {missing > 0 && (
            <p className="mt-4 text-center text-xs text-slate-400">
              {missing} candidature{missing > 1 ? "s" : ""} n'{missing > 1 ? "apparaissent" : "apparaît"} plus
              (offre{missing > 1 ? "s" : ""} probablement comblée{missing > 1 ? "s" : ""} ou retirée{missing > 1 ? "s" : ""}).
            </p>
          )}
        </>
      )}
    </div>
  );
}
