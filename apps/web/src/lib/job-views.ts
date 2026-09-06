"use client";

/**
 * Vues de fiche offre (idée 89). Même schéma que les clics Postuler.
 */
import { summarizeApplyClicks, type ApplyClickEvent, type ApplyClickStats } from "./apply-clicks-stats";
import { supabase } from "./supabase";

const KEY = "jobccq:job-views";
const MAX = 500;
const DEDUPE_MS = 30_000;
let last: { jobId: string; at: number } | null = null;

function read(): ApplyClickEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ApplyClickEvent[]) : [];
  } catch {
    return [];
  }
}

function persist(list: ApplyClickEvent[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    /* quota */
  }
}

export function recordJobView(job: { id: string; sourceId: string; title: string }): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (last && last.jobId === job.id && now - last.at < DEDUPE_MS) return;
  last = { jobId: job.id, at: now };
  const event: ApplyClickEvent = { jobId: job.id, sourceId: job.sourceId, title: job.title, at: now };
  persist([...read(), event]);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return;
  void fetch(`${url}/rest/v1/job_views`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ job_id: event.jobId, source_id: event.sourceId, title: event.title }),
    keepalive: true,
  }).catch(() => {});
}

export function localJobViewStats(): ApplyClickStats {
  return summarizeApplyClicks(read());
}

export async function fetchJobViewStats(): Promise<{ stats: ApplyClickStats; source: "supabase" | "local" }> {
  const local = read();
  if (supabase) {
    const { data, error } = await supabase
      .from("job_views")
      .select("job_id, source_id, title, at")
      .order("at", { ascending: false })
      .limit(2000);
    if (!error && data) {
      const remote = data.map((r) => ({
        jobId: String(r.job_id),
        sourceId: String(r.source_id),
        title: String(r.title ?? r.job_id),
        at: r.at ? Date.parse(String(r.at)) : 0,
      }));
      if (remote.length) return { stats: summarizeApplyClicks(remote), source: "supabase" };
    }
  }
  return { stats: summarizeApplyClicks(local), source: "local" };
}
