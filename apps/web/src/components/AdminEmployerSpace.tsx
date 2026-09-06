"use client";

import { useCallback, useEffect, useState } from "react";
import { getEmployer, labelForClaimStatus, labelForEmployerJobStatus } from "@jobccq/shared";
import { fetchAllClaims, setClaimStatus, type EmployerClaim } from "@/lib/employer-claims";
import { fetchAllEmployerJobs, setEmployerJobStatus, type EmployerJobRow } from "@/lib/employer-jobs";
import { invalidateJobsCache } from "@/lib/data";
import { Badge } from "./Badge";

/** File admin : réclamations + offres employeur. */
export function AdminEmployerSpace() {
  const [claims, setClaims] = useState<EmployerClaim[]>([]);
  const [jobs, setJobs] = useState<EmployerJobRow[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const [c, j] = await Promise.all([fetchAllClaims(), fetchAllEmployerJobs()]);
      setClaims(c);
      setJobs(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-slate-600">{msg}</p>}

      <section>
        <h2 className="mb-2 font-semibold">Réclamations</h2>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {claims.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">Aucune réclamation.</li>}
          {claims.map((c) => (
            <li key={`${c.userId}-${c.employerId}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>
                {getEmployer(c.employerId)?.name ?? c.employerId}{" "}
                <Badge>{labelForClaimStatus(c.status)}</Badge>
                {c.note ? <span className="text-slate-400"> — {c.note}</span> : null}
              </span>
              {c.status === "pending" && (
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-green-600 px-2 py-1 text-xs font-semibold text-white"
                    onClick={async () => {
                      await setClaimStatus(c.userId, c.employerId, "approved");
                      setMsg("Réclamation approuvée.");
                      await load();
                    }}
                  >
                    Approuver
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-slate-200 px-2 py-1 text-xs font-semibold"
                    onClick={async () => {
                      await setClaimStatus(c.userId, c.employerId, "rejected");
                      setMsg("Réclamation refusée.");
                      await load();
                    }}
                  >
                    Refuser
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Offres employeur</h2>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {jobs.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">Aucune offre soumise.</li>}
          {jobs.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>
                {r.job.title}{" "}
                <span className="text-slate-400">· {r.job.company}</span>{" "}
                <Badge>{labelForEmployerJobStatus(r.status)}</Badge>
              </span>
              {r.status === "pending" && (
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-green-600 px-2 py-1 text-xs font-semibold text-white"
                    onClick={async () => {
                      await setEmployerJobStatus(r.id, "approved");
                      invalidateJobsCache();
                      setMsg("Offre publiée.");
                      await load();
                    }}
                  >
                    Publier
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-slate-200 px-2 py-1 text-xs font-semibold"
                    onClick={async () => {
                      await setEmployerJobStatus(r.id, "rejected");
                      setMsg("Offre refusée.");
                      await load();
                    }}
                  >
                    Refuser
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
