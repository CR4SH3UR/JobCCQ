"use client";

import { useCallback, useEffect, useState } from "react";
import {
  canRevokeClaim,
  claimantLabel,
  getEmployer,
  labelForClaimStatus,
  labelForEmployerJobStatus,
} from "@jobccq/shared";
import {
  deleteClaim,
  fetchAllClaims,
  lookupUserEmails,
  revokeClaim,
  setClaimStatus,
  withLookupEmails,
  type EmployerClaim,
} from "@/lib/employer-claims";
import { fetchAllEmployerJobs, setEmployerJobStatus, type EmployerJobRow } from "@/lib/employer-jobs";
import { invalidateJobsCache } from "@/lib/data";
import { Badge } from "./Badge";

function formatWhen(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

/** File admin : réclamations + offres employeur. */
export function AdminEmployerSpace() {
  const [claims, setClaims] = useState<EmployerClaim[]>([]);
  const [jobs, setJobs] = useState<EmployerJobRow[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busyKey, setBusyKey] = useState("");

  const load = useCallback(async () => {
    try {
      const [c, j] = await Promise.all([fetchAllClaims(), fetchAllEmployerJobs()]);
      const emails = await lookupUserEmails(c.map((x) => x.userId));
      setClaims(withLookupEmails(c, emails));
      setJobs(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (key: string, fn: () => Promise<void>, done: string) => {
    setBusyKey(key);
    setError("");
    try {
      await fn();
      setMsg(done);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-slate-600">{msg}</p>}

      <section>
        <h2 className="mb-2 font-semibold">Réclamations</h2>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {claims.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">Aucune réclamation.</li>}
          {claims.map((c) => {
            const key = `${c.userId}-${c.employerId}`;
            const who = claimantLabel(c.email, c.userId);
            const when = formatWhen(c.createdAt);
            return (
              <li key={key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{getEmployer(c.employerId)?.name ?? c.employerId}</span>{" "}
                  <Badge>{labelForClaimStatus(c.status)}</Badge>
                  <span className="mt-0.5 block text-slate-600">
                    de{" "}
                    {c.email ? (
                      <a className="font-medium text-brand-700 hover:underline" href={`mailto:${c.email}`}>
                        {c.email}
                      </a>
                    ) : (
                      <span className="font-medium">{who}</span>
                    )}
                    {when ? <span className="text-slate-400"> · {when}</span> : null}
                  </span>
                  {c.note ? <span className="block text-slate-400">{c.note}</span> : null}
                </span>
                <span className="flex flex-wrap gap-2">
                  {c.status === "pending" && (
                    <>
                      <button
                        type="button"
                        disabled={busyKey === key}
                        className="rounded-lg bg-green-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        onClick={() =>
                          act(key, () => setClaimStatus(c.userId, c.employerId, "approved"), "Réclamation approuvée.")
                        }
                      >
                        Approuver
                      </button>
                      <button
                        type="button"
                        disabled={busyKey === key}
                        className="rounded-lg bg-slate-200 px-2 py-1 text-xs font-semibold disabled:opacity-50"
                        onClick={() =>
                          act(key, () => setClaimStatus(c.userId, c.employerId, "rejected"), "Réclamation refusée.")
                        }
                      >
                        Refuser
                      </button>
                    </>
                  )}
                  {canRevokeClaim(c.status) && (
                    <button
                      type="button"
                      disabled={busyKey === key}
                      className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                      onClick={() => {
                        if (
                          !confirm(
                            `Révoquer la fiche ${getEmployer(c.employerId)?.name ?? c.employerId} pour ${who} ?`,
                          )
                        ) {
                          return;
                        }
                        void act(
                          key,
                          () => revokeClaim(c.userId, c.employerId),
                          "Réclamation révoquée — le compte n'a plus accès à cette fiche.",
                        );
                      }}
                    >
                      Révoquer
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyKey === key}
                    className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
                    onClick={() => {
                      if (
                        !confirm(
                          `Supprimer la demande de ${who} pour ${getEmployer(c.employerId)?.name ?? c.employerId} ?`,
                        )
                      ) {
                        return;
                      }
                      void act(
                        key,
                        () => deleteClaim(c.userId, c.employerId),
                        "Demande supprimée.",
                      );
                    }}
                  >
                    Supprimer
                  </button>
                </span>
              </li>
            );
          })}
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
