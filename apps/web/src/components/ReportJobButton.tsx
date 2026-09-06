"use client";

import { useEffect, useId, useState } from "react";
import type { Job } from "@jobccq/shared";
import { useAuth } from "@/lib/auth";
import {
  REPORT_COMMENT_MAX,
  REPORT_REASONS,
  labelForReportReason,
  submitJobReport,
  useHasReportedJob,
  type ReportReason,
} from "@/lib/job-reports";

const HINT: Record<ReportReason, string> = {
  expired: "Le lien ne mène plus à un poste ouvert, ou l'employeur l'a retiré.",
  misleading: "Salaire, lieu, métier ou employeur ne correspondent pas à l'annonce.",
  duplicate: "La même offre apparaît déjà ailleurs (autre source ou doublon).",
};

/** Bouton « Signaler » sur la fiche — motif + commentaire optionnel. */
export function ReportJobButton({ job }: { job: Job }) {
  const titleId = useId();
  const already = useHasReportedJob(job.id);
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("expired");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(already);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setDone(already);
  }, [already]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = async () => {
    if (busy || done) return;
    setBusy(true);
    const result = await submitJobReport(
      {
        jobId: job.id,
        sourceId: job.sourceId,
        title: job.title,
        company: job.company,
        url: job.url,
        reason,
        comment,
      },
      { reporterId: user?.id ?? null },
    );
    setBusy(false);
    if (result === "invalid") return;
    setDone(true);
    setOffline(result === "offline");
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => !done && setOpen(true)}
        disabled={done}
        aria-pressed={done}
        className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700 disabled:cursor-default disabled:opacity-60"
      >
        {done ? "Signalée" : "Signaler"}
      </button>
      {done && offline && (
        <p className="basis-full text-xs text-amber-700">
          Conservé dans ce navigateur — la file de modération sera mise à jour quand le réseau
          reviendra.
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <button
            type="button"
            aria-label="Fermer le signalement"
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 text-left shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <h2 id={titleId} className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Signaler cette offre
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {job.title} — {job.company}. Un modérateur vérifiera le motif.
            </p>
            <fieldset className="mt-4 space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Motif
              </legend>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 dark:border-slate-700 dark:has-[:checked]:bg-brand-500/10"
                >
                  <input
                    type="radio"
                    name="report-reason"
                    className="mt-1"
                    checked={reason === r}
                    onChange={() => setReason(r)}
                  />
                  <span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {labelForReportReason(r)}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">{HINT[r]}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Précision (optionnel)
              </span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, REPORT_COMMENT_MAX))}
                rows={3}
                maxLength={REPORT_COMMENT_MAX}
                placeholder="Lien du doublon, détail trompeur…"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-950"
              />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? "Envoi…" : "Envoyer le signalement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
