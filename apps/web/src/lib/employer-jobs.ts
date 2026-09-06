/**
 * Offres publiées par un employeur (idée 88), en attente de modération.
 */
import {
  draftToJob,
  parseEmployerJobStatus,
  validateEmployerJobDraft,
  type EmployerJobDraft,
  type EmployerJobStatus,
  type Job,
} from "@jobccq/shared";
import { supabase } from "./supabase";

export type EmployerJobRow = {
  id: string;
  employerId: string;
  userId: string;
  status: EmployerJobStatus;
  job: Job;
  createdAt: string;
};

const KEY = "jobccq:employer-jobs";

function readLocal(): EmployerJobRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as EmployerJobRow[]) : [];
  } catch {
    return [];
  }
}

function persist(list: EmployerJobRow[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* quota */
  }
}

function parseRow(r: Record<string, unknown>): EmployerJobRow | null {
  const status = parseEmployerJobStatus(r.status);
  const job = r.job as Job | undefined;
  const id = String(r.id ?? job?.id ?? "");
  const employerId = String(r.employer_id ?? job?.sourceId ?? "");
  if (!status || !job?.title || !id || !employerId) return null;
  return {
    id,
    employerId,
    userId: String(r.user_id ?? ""),
    status,
    job,
    createdAt: String(r.created_at ?? job.postedAt ?? ""),
  };
}

export async function fetchApprovedEmployerJobs(): Promise<Job[]> {
  const local = readLocal().filter((r) => r.status === "approved").map((r) => r.job);
  if (!supabase) return local;
  const { data, error } = await supabase
    .from("employer_jobs")
    .select("id, employer_id, user_id, status, job, created_at")
    .eq("status", "approved")
    .limit(500);
  if (error || !data) return local;
  const remote = data.map((r) => parseRow(r as Record<string, unknown>)).filter(Boolean) as EmployerJobRow[];
  const seen = new Set(remote.map((r) => r.id));
  return [...remote.map((r) => r.job), ...local.filter((j) => !seen.has(j.id))];
}

export async function fetchMyEmployerJobs(userId: string): Promise<EmployerJobRow[]> {
  const local = readLocal().filter((r) => !userId || r.userId === userId || r.userId === "local");
  if (!supabase || !userId) return local;
  const { data, error } = await supabase
    .from("employer_jobs")
    .select("id, employer_id, user_id, status, job, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return local;
  return data.map((r) => parseRow(r as Record<string, unknown>)).filter(Boolean) as EmployerJobRow[];
}

export async function fetchAllEmployerJobs(): Promise<EmployerJobRow[]> {
  if (!supabase) return readLocal();
  const { data, error } = await supabase
    .from("employer_jobs")
    .select("id, employer_id, user_id, status, job, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error || !data) return readLocal();
  return data.map((r) => parseRow(r as Record<string, unknown>)).filter(Boolean) as EmployerJobRow[];
}

export async function submitEmployerJob(
  draft: EmployerJobDraft,
  employer: { id: string; name: string },
  userId: string,
): Promise<EmployerJobRow> {
  const checked = validateEmployerJobDraft(draft);
  if (!checked.ok || !checked.value) throw new Error(checked.errors.join(" "));
  const createdAt = new Date().toISOString();
  const job = draftToJob(checked.value, employer, createdAt);
  const row: EmployerJobRow = {
    id: job.id,
    employerId: employer.id,
    userId: userId || "local",
    status: supabase && userId ? "pending" : "approved",
    job,
    createdAt,
  };
  persist([row, ...readLocal().filter((r) => r.id !== row.id)]);
  if (supabase && userId) {
    const { error } = await supabase.from("employer_jobs").insert({
      id: row.id,
      employer_id: employer.id,
      user_id: userId,
      status: row.status,
      job,
    });
    if (error) throw new Error(error.message);
  }
  return row;
}

export async function setEmployerJobStatus(id: string, status: EmployerJobStatus): Promise<void> {
  persist(readLocal().map((r) => (r.id === id ? { ...r, status } : r)));
  if (!supabase) return;
  const { error } = await supabase.from("employer_jobs").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}
