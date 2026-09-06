/**
 * Motifs / statuts de signalement — parseurs purs, testables hors-ligne.
 */
export const REPORT_REASONS = ["expired", "misleading", "duplicate"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["pending", "reviewed", "dismissed", "actioned"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface JobReportDraft {
  jobId: string;
  sourceId: string;
  title: string;
  company?: string;
  url?: string;
  reason: ReportReason;
  comment: string;
}

export const REPORT_COMMENT_MAX = 500;

export function labelForReportReason(reason: ReportReason): string {
  if (reason === "expired") return "Expirée / pourvue";
  if (reason === "misleading") return "Trompeuse";
  return "Doublon";
}

export function labelForReportStatus(status: ReportStatus): string {
  if (status === "pending") return "En attente";
  if (status === "reviewed") return "Vu";
  if (status === "dismissed") return "Rejeté";
  return "Traité";
}

export function parseReportReason(raw: unknown): ReportReason | null {
  return REPORT_REASONS.includes(raw as ReportReason) ? (raw as ReportReason) : null;
}

export function parseReportStatus(raw: unknown): ReportStatus | null {
  return REPORT_STATUSES.includes(raw as ReportStatus) ? (raw as ReportStatus) : null;
}

export function clipReportComment(raw: unknown, max = REPORT_COMMENT_MAX): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

/** Corps d'insert Supabase, ou `null` si le brouillon est invalide. */
export function buildReportPayload(draft: JobReportDraft): Record<string, unknown> | null {
  const jobId = String(draft.jobId ?? "").trim();
  const reason = parseReportReason(draft.reason);
  if (!jobId || !reason) return null;
  return {
    job_id: jobId,
    source_id: String(draft.sourceId ?? "").trim() || null,
    title: String(draft.title ?? "").trim() || jobId,
    company: String(draft.company ?? "").trim() || null,
    url: String(draft.url ?? "").trim() || null,
    reason,
    comment: clipReportComment(draft.comment) || null,
    status: "pending",
  };
}
