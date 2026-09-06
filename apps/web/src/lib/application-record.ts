export const APPLICATION_STATUSES = [
  { id: "a-postuler", label: "À postuler" },
  { id: "postule", label: "Postulé" },
  { id: "entrevue", label: "Entrevue" },
  { id: "refuse", label: "Refusé" },
  { id: "accepte", label: "Accepté" },
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]["id"];

export interface ApplicationRecord {
  jobId: string;
  status: ApplicationStatus;
  note: string;
  remindAt: string;
  updatedAt: string;
}

const STATUS_IDS = new Set<string>(APPLICATION_STATUSES.map((s) => s.id));

function asStatus(v: unknown): ApplicationStatus {
  return typeof v === "string" && STATUS_IDS.has(v) ? (v as ApplicationStatus) : "postule";
}

function recordOf(jobId: string, partial: Partial<ApplicationRecord> = {}): ApplicationRecord {
  return {
    jobId,
    status: asStatus(partial.status),
    note: typeof partial.note === "string" ? partial.note : "",
    remindAt: typeof partial.remindAt === "string" ? partial.remindAt : "",
    updatedAt: partial.updatedAt ?? new Date().toISOString(),
  };
}

/** Ancien format (ids) ou map enrichie → fiches de candidature. */
export function parseApplicationStore(raw: unknown): Map<string, ApplicationRecord> {
  const out = new Map<string, ApplicationRecord>();
  if (Array.isArray(raw)) {
    for (const id of raw) {
      const jobId = String(id ?? "").trim();
      if (jobId) out.set(jobId, recordOf(jobId));
    }
    return out;
  }
  if (!raw || typeof raw !== "object") return out;
  for (const [jobId, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!jobId) continue;
    if (v && typeof v === "object") {
      out.set(jobId, recordOf(jobId, v as Partial<ApplicationRecord>));
    } else {
      out.set(jobId, recordOf(jobId));
    }
  }
  return out;
}

export function serializeApplicationStore(map: Map<string, ApplicationRecord>): Record<string, ApplicationRecord> {
  return Object.fromEntries(map);
}

export function upsertApplication(
  map: Map<string, ApplicationRecord>,
  jobId: string,
  patch: Partial<ApplicationRecord>,
): Map<string, ApplicationRecord> {
  const next = new Map(map);
  const prev = next.get(jobId);
  next.set(jobId, recordOf(jobId, { ...prev, ...patch, updatedAt: new Date().toISOString() }));
  return next;
}

export function removeApplication(
  map: Map<string, ApplicationRecord>,
  jobId: string,
): Map<string, ApplicationRecord> {
  const next = new Map(map);
  next.delete(jobId);
  return next;
}

export function labelForApplicationStatus(id: string): string {
  return APPLICATION_STATUSES.find((s) => s.id === id)?.label ?? id;
}

export { isReminderDue, reminderNeedsNotify } from "@jobccq/shared";
