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

let cache: ApplyClickEvent[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: ApplyClickEvent[] = [];

function read(): ApplyClickEvent[] {
  if (cache) return cache;
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

export function recordApplyClick(job: { id: string; sourceId: string; title: string }): void {
  if (typeof window === "undefined") return;
  const event: ApplyClickEvent = {
    jobId: job.id,
    sourceId: job.sourceId,
    title: job.title,
    at: Date.now(),
  };
  persist([...read(), event]);
  void supabase
    ?.from("apply_clicks")
    .insert({ job_id: job.id, source_id: job.sourceId, title: job.title })
    .then(({ error }) => {
      if (error) {
        /* table absente ou RLS : le miroir local suffit */
      }
    });
}

export function localApplyClickStats(): ApplyClickStats {
  return summarizeApplyClicks(read());
}

/** Charge les clics distants (admin authentifié). Repli local si la table est vide. */
export async function fetchApplyClickStats(): Promise<{ stats: ApplyClickStats; source: "supabase" | "local" }> {
  if (supabase) {
    const { data, error } = await supabase
      .from("apply_clicks")
      .select("job_id, source_id, title, at")
      .order("at", { ascending: false })
      .limit(2000);
    if (!error && data && data.length > 0) {
      const events: ApplyClickEvent[] = data.map((r) => ({
        jobId: String(r.job_id),
        sourceId: String(r.source_id),
        title: String(r.title ?? r.job_id),
        at: r.at ? Date.parse(String(r.at)) : 0,
      }));
      return { stats: summarizeApplyClicks(events), source: "supabase" };
    }
  }
  return { stats: localApplyClickStats(), source: "local" };
}

export function subscribeApplyClicks(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useLocalApplyClickStats(): ApplyClickStats {
  return useSyncExternalStore(subscribeApplyClicks, localApplyClickStats, () =>
    summarizeApplyClicks(EMPTY),
  );
}
