"use client";

/**
 * Clics « Postuler » : miroir localStorage (ce navigateur) + insert Supabase
 * `apply_clicks` (tous les visiteurs, RLS insert anonyme). L'admin lit la table
 * une fois connecté. Table absente / hors-ligne → seul le miroir local compte.
 */
import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { summarizeApplyClicks, type ApplyClickEvent, type ApplyClickStats } from "./apply-clicks-stats";

export type { ApplyClickEvent, ApplyClickStats };

const KEY = "jobccq:apply-clicks";
const MAX = 500;
const DEDUPE_MS = 2_000;

let cache: ApplyClickEvent[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: ApplyClickEvent[] = [];
let lastRecord: { jobId: string; at: number } | null = null;

function read(): ApplyClickEvent[] {
  if (cache !== null) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as ApplyClickEvent[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function persist(list: ApplyClickEvent[]): void {
  cache = list.slice(-MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* stockage indisponible */
  }
  listeners.forEach((l) => l());
}

/** Insert REST avec `keepalive` : survit à l'ouverture d'un nouvel onglet. */
function postRemote(event: ApplyClickEvent): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return;
  void fetch(`${url}/rest/v1/apply_clicks`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      job_id: event.jobId,
      source_id: event.sourceId,
      title: event.title,
    }),
    keepalive: true,
  }).catch(() => {
    /* hors-ligne : le miroir local suffit */
  });
}

export function recordApplyClick(job: { id: string; sourceId: string; title: string }): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (lastRecord && lastRecord.jobId === job.id && now - lastRecord.at < DEDUPE_MS) return;
  lastRecord = { jobId: job.id, at: now };
  const event: ApplyClickEvent = {
    jobId: job.id,
    sourceId: job.sourceId,
    title: job.title,
    at: now,
  };
  persist([...read(), event]);
  postRemote(event);
}

export function localApplyClickStats(): ApplyClickStats {
  return summarizeApplyClicks(read());
}

function eventsFromRows(
  data: { job_id: unknown; source_id: unknown; title: unknown; at: unknown }[],
): ApplyClickEvent[] {
  return data.map((r) => ({
    jobId: String(r.job_id),
    sourceId: String(r.source_id),
    title: String(r.title ?? r.job_id),
    at: r.at ? Date.parse(String(r.at)) : 0,
  }));
}

/** Charge les clics distants (admin authentifié). Fusionne avec le miroir local. */
export async function fetchApplyClickStats(): Promise<{ stats: ApplyClickStats; source: "supabase" | "local" }> {
  const local = read();
  if (supabase) {
    const { data, error } = await supabase
      .from("apply_clicks")
      .select("job_id, source_id, title, at")
      .order("at", { ascending: false })
      .limit(2000);
    if (!error && data) {
      const remote = eventsFromRows(data);
      if (remote.length > 0) {
        const seen = new Set(remote.map((e) => `${e.jobId}|${e.at}`));
        const extra = local.filter((e) => !seen.has(`${e.jobId}|${e.at}`));
        return { stats: summarizeApplyClicks([...remote, ...extra]), source: "supabase" };
      }
    }
  }
  return { stats: summarizeApplyClicks(local), source: "local" };
}

export function subscribeApplyClicks(fn: () => void): () => void {
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

export function useLocalApplyClickStats(): ApplyClickStats {
  return useSyncExternalStore(subscribeApplyClicks, localApplyClickStats, () =>
    summarizeApplyClicks(EMPTY),
  );
}
