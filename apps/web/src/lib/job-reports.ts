"use client";

/**
 * Signalements d'offres (idée 93) : miroir localStorage + table Supabase
 * `job_reports`. Tout visiteur peut insérer ; la file de modération est
 * réservée aux admins (RLS). Table absente / hors-ligne → le miroir local
 * empêche de renvoyer le même signalement depuis ce navigateur.
 */
import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import {
  buildReportPayload,
  parseReportReason,
  parseReportStatus,
  type JobReportDraft,
  type ReportReason,
  type ReportStatus,
} from "./job-reports-parse.js";

export {
  REPORT_COMMENT_MAX,
  REPORT_REASONS,
  REPORT_STATUSES,
  buildReportPayload,
  clipReportComment,
  labelForReportReason,
  labelForReportStatus,
  parseReportReason,
  parseReportStatus,
  type JobReportDraft,
  type ReportReason,
  type ReportStatus,
} from "./job-reports-parse.js";

export interface JobReport {
  id: string;
  jobId: string;
  sourceId: string;
  title: string;
  company: string;
  url: string;
  reason: ReportReason;
  comment: string;
  reporterId: string | null;
  status: ReportStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

interface LocalReport {
  jobId: string;
  reason: ReportReason;
  at: number;
}

const KEY = "jobccq:job-reports";
const MAX_LOCAL = 80;

let cache: LocalReport[] | null = null;
const listeners = new Set<() => void>();
const EMPTY_IDS: ReadonlySet<string> = new Set();

function readLocal(): LocalReport[] {
  if (cache !== null) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as LocalReport[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function persistLocal(list: LocalReport[]): void {
  cache = list.slice(-MAX_LOCAL);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* stockage indisponible */
  }
  listeners.forEach((l) => l());
}

export function localReportedJobIds(): ReadonlySet<string> {
  return new Set(readLocal().map((r) => r.jobId));
}

export function hasReportedJob(jobId: string): boolean {
  return readLocal().some((r) => r.jobId === jobId);
}

function markReported(jobId: string, reason: ReportReason): void {
  const next = readLocal().filter((r) => r.jobId !== jobId);
  next.push({ jobId, reason, at: Date.now() });
  persistLocal(next);
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    fn();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function useHasReportedJob(jobId: string): boolean {
  return useSyncExternalStore(subscribe, () => hasReportedJob(jobId), () => false);
}

export function useReportedJobIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, localReportedJobIds, () => EMPTY_IDS);
}

function rowToReport(r: Record<string, unknown>): JobReport | null {
  const reason = parseReportReason(r.reason);
  if (!reason || !r.id || !r.job_id) return null;
  return {
    id: String(r.id),
    jobId: String(r.job_id),
    sourceId: String(r.source_id ?? ""),
    title: String(r.title ?? r.job_id),
    company: String(r.company ?? ""),
    url: String(r.url ?? ""),
    reason,
    comment: String(r.comment ?? ""),
    reporterId: r.reporter_id ? String(r.reporter_id) : null,
    status: parseReportStatus(r.status) ?? "pending",
    createdAt: String(r.created_at ?? ""),
    reviewedAt: r.reviewed_at ? String(r.reviewed_at) : null,
    reviewedBy: r.reviewed_by ? String(r.reviewed_by) : null,
  };
}

async function postRemote(payload: Record<string, unknown>, reporterId?: string | null): Promise<boolean> {
  if (supabase) {
    const row = reporterId ? { ...payload, reporter_id: reporterId } : payload;
    const { error } = await supabase.from("job_reports").insert(row);
    if (!error) return true;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return false;
  try {
    const r = await fetch(`${url}/rest/v1/job_reports`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    return r.ok;
  } catch {
    return false;
  }
}

export type SubmitReportResult = "ok" | "duplicate" | "invalid" | "offline";

/** Enregistre un signalement (optimiste local + insert distant). */
export async function submitJobReport(
  draft: JobReportDraft,
  opts: { reporterId?: string | null } = {},
): Promise<SubmitReportResult> {
  if (typeof window === "undefined") return "offline";
  const payload = buildReportPayload(draft);
  if (!payload) return "invalid";
  if (hasReportedJob(draft.jobId)) return "duplicate";
  markReported(draft.jobId, draft.reason);
  const ok = await postRemote(payload, opts.reporterId);
  return ok ? "ok" : "offline";
}

/** File de modération (admin authentifié). Vide si table absente. */
export async function fetchJobReports(): Promise<{ reports: JobReport[]; source: "supabase" | "empty" }> {
  if (!supabase) return { reports: [], source: "empty" };
  const { data, error } = await supabase
    .from("job_reports")
    .select("id, job_id, source_id, title, company, url, reason, comment, reporter_id, status, created_at, reviewed_at, reviewed_by")
    .order("created_at", { ascending: false })
    .limit(400);
  if (error || !data) return { reports: [], source: "empty" };
  const reports = data
    .map((r) => rowToReport(r as Record<string, unknown>))
    .filter((r): r is JobReport => r !== null);
  return { reports, source: reports.length || !error ? "supabase" : "empty" };
}

export async function updateJobReport(
  id: string,
  patch: { status: ReportStatus; reviewedBy?: string | null },
): Promise<void> {
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { error } = await supabase
    .from("job_reports")
    .update({
      status: patch.status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: patch.reviewedBy ?? null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
