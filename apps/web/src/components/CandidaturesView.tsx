"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Job } from "@jobccq/shared";
import { searchJobs, buildQuery } from "@/lib/data";
import { JobCard } from "./JobCard";
import {
  APPLICATION_STATUSES,
  isReminderDue,
  labelForApplicationStatus,
  patchApplication,
  useApplicationRecords,
  useApplications,
} from "@/lib/applications";
import { useAuth } from "@/lib/auth";
import { downloadCsv } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { supabaseEnabled } from "@/lib/supabase";

/**
 * Page « Mes candidatures » : pipeline (à postuler → accepté), notes et rappels.
 */
export function CandidaturesView() {
  const applied = useApplications();
  const records = useApplicationRecords();
  const { user } = useAuth();
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
  const due = useMemo(
    () => items.filter((j) => isReminderDue(records.get(j.id)?.remindAt)),
    [items, records],
  );

  const exportCsv = () => {
    const base = siteUrl("/").replace(/\/$/, "");
    const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const lines = [["titre", "entreprise", "statut", "note", "rappel", "url"].map(esc).join(",")];
    for (const j of items) {
      const rec = records.get(j.id);
      lines.push(
        [
          j.title,
          j.company,
          rec ? labelForApplicationStatus(rec.status) : "",
          rec?.note ?? "",
          rec?.remindAt ?? "",
          `${base}/emplois/${j.id}/`,
        ]
          .map(esc)
          .join(","),
      );
    }
    downloadCsv("jobccq-candidatures.csv", lines.join("\n"));
  };

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
            la retrouver ici, noter un suivi et un rappel.
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
          {due.length > 0 && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100">
              {due.length} rappel{due.length > 1 ? "s" : ""} à faire :{" "}
              {due.map((j) => j.title).join(" · ")}
              {supabaseEnabled && user ? " · une notif part aussi par tes canaux habituels." : ""}
            </div>
          )}
          {supabaseEnabled && !user && (
            <p className="mb-3 text-sm text-slate-600">
              Connecte-toi pour recevoir un courriel (et push / ntfy si tu les as déjà réglés) le jour
              du rappel.
            </p>
          )}
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{items.length}</span> candidature
              {items.length > 1 ? "s" : ""} suivie{items.length > 1 ? "s" : ""}
            </p>
            {items.length > 0 && (
              <button
                type="button"
                onClick={exportCsv}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Export CSV
              </button>
            )}
          </div>
          <div className="space-y-3">
            {items.map((job) => (
              <div key={job.id}>
                <JobCard job={job} />
                <ApplicationTrack id={job.id} />
              </div>
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

function ApplicationTrack({ id }: { id: string }) {
  const rec = useApplicationRecords().get(id);
  const [note, setNote] = useState(rec?.note ?? "");
  useEffect(() => {
    setNote(rec?.note ?? "");
  }, [rec?.note]);
  if (!rec) return null;
  const due = isReminderDue(rec.remindAt);
  return (
    <div className="mt-1 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-800">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Statut</span>
          <select
            value={rec.status}
            onChange={(e) => patchApplication(id, { status: e.target.value as typeof rec.status })}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
          >
            {APPLICATION_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Relancer le</span>
          <input
            type="date"
            value={rec.remindAt}
            onChange={(e) => patchApplication(id, { remindAt: e.target.value })}
            className={`rounded-lg border bg-white px-2 py-1 text-sm ${
              due ? "border-amber-400" : "border-slate-200"
            }`}
          />
        </label>
      </div>
      {supabaseEnabled && (
        <p className="mt-1.5 text-[11px] text-slate-500">
          Notif le jour J : courriel du compte, push Expo, ntfy/webhook de tes alertes emploi.
        </p>
      )}
      <label className="mt-2 flex flex-col gap-0.5">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">Note</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note !== rec.note) patchApplication(id, { note });
          }}
          rows={2}
          placeholder="Relancer, nom du recruteur, suite…"
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
        />
      </label>
    </div>
  );
}
