"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/admin-audit";
import { invalidateJobOverrides } from "@/lib/data";
import { setJobHidden } from "@/lib/job-overrides";
import {
  labelForReportReason,
  labelForReportStatus,
  fetchJobReports,
  updateJobReport,
  type JobReport,
  type ReportReason,
  type ReportStatus,
} from "@/lib/job-reports";
import { supabaseEnabled } from "@/lib/supabase";

type StatusFilter = "pending" | "all" | ReportStatus;
type ReasonFilter = "all" | ReportReason;

function formatWhen(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

/** File de modération des signalements utilisateurs. */
export function AdminReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<JobReport[]>([]);
  const [source, setSource] = useState<"supabase" | "empty">("empty");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const r = await fetchJobReports();
      setReports(r.reports);
      setSource(r.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(() => reports.filter((r) => r.status === "pending").length, [reports]);

  const visible = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (reasonFilter !== "all" && r.reason !== reasonFilter) return false;
      return true;
    });
  }, [reports, statusFilter, reasonFilter]);

  const setStatus = async (report: JobReport, status: ReportStatus, hide = false) => {
    setBusyId(report.id);
    setMsg("");
    try {
      if (hide) {
        await setJobHidden(report.jobId, true);
        invalidateJobOverrides();
      }
      await updateJobReport(report.id, { status, reviewedBy: user?.email ?? null });
      logAudit("edit", {
        targetId: report.jobId,
        targetName: report.title,
        detail: hide ? `signalement masqué (${report.reason})` : `signalement ${status}`,
      });
      setReports((list) =>
        list.map((r) =>
          r.id === report.id
            ? {
                ...r,
                status,
                reviewedAt: new Date().toISOString(),
                reviewedBy: user?.email ?? null,
              }
            : r,
        ),
      );
      setMsg(hide ? "Offre masquée du site public." : `Signalement ${labelForReportStatus(status).toLowerCase()}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Signalements</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          File des offres signalées par les visiteurs (expirée, trompeuse, doublon).
          {pendingCount > 0 ? ` ${pendingCount} en attente.` : ""}
        </p>
      </div>

      {!supabaseEnabled && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Supabase n'est pas configuré dans ce navigateur — la file distante est vide. Les
          signalements locaux des visiteurs arriveront une fois la table{" "}
          <code>job_reports</code> créée (voir <code>infra/README-supabase.md</code>).
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-slate-500">Statut</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="pending">En attente</option>
            <option value="all">Tous</option>
            <option value="reviewed">Vu</option>
            <option value="dismissed">Rejeté</option>
            <option value="actioned">Traité</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-slate-500">Motif</span>
          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value as ReasonFilter)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="all">Tous</option>
            <option value="expired">Expirée / pourvue</option>
            <option value="misleading">Trompeuse</option>
            <option value="duplicate">Doublon</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700"
        >
          Actualiser
        </button>
        <span className="text-xs text-slate-500">
          {loading ? "Chargement…" : `${visible.length} / ${reports.length}`}
          {source === "empty" && supabaseEnabled ? " · table absente ou vide" : ""}
          {msg ? ` · ${msg}` : ""}
        </span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && visible.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
          Aucun signalement dans ce filtre.
        </p>
      )}

      <ul className="space-y-2">
        {visible.map((r) => (
          <li
            key={r.id}
            className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{r.title}</p>
                <p className="text-slate-500">
                  {r.company || r.sourceId}
                  {r.sourceId ? ` · ${r.sourceId}` : ""}
                </p>
              </div>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  r.status === "pending"
                    ? "bg-amber-100 text-amber-800"
                    : r.status === "actioned"
                      ? "bg-green-100 text-green-800"
                      : r.status === "dismissed"
                        ? "bg-slate-100 text-slate-600"
                        : "bg-sky-100 text-sky-800"
                }`}
              >
                {labelForReportStatus(r.status)}
              </span>
            </div>
            <p className="mt-2 text-slate-700 dark:text-slate-200">
              <span className="font-medium">{labelForReportReason(r.reason)}</span>
              <span className="text-slate-400"> · {formatWhen(r.createdAt)}</span>
            </p>
            {r.comment && <p className="mt-1 text-slate-600 dark:text-slate-300">« {r.comment} »</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href={`/emplois/${r.jobId}/`}
                className="text-xs font-semibold text-brand-700 hover:underline"
              >
                Voir la fiche
              </Link>
              {r.url && (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand-700 hover:underline"
                >
                  Source
                </a>
              )}
              {r.status === "pending" && (
                <>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void setStatus(r, "actioned", true)}
                    className="rounded border border-amber-300 px-2 py-0.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                  >
                    Masquer du site
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void setStatus(r, "reviewed")}
                    className="rounded border border-slate-300 px-2 py-0.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                  >
                    Marquer vu
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void setStatus(r, "dismissed")}
                    className="rounded border border-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Rejeter
                  </button>
                </>
              )}
              {r.reviewedBy && (
                <span className="text-[11px] text-slate-400">
                  par {r.reviewedBy}
                  {r.reviewedAt ? ` · ${formatWhen(r.reviewedAt)}` : ""}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
