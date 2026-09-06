"use client";

import { useMemo, useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import {
  parseApplicationStore,
  removeApplication,
  serializeApplicationStore,
  upsertApplication,
  type ApplicationRecord,
} from "./application-record";

export {
  APPLICATION_STATUSES,
  isReminderDue,
  labelForApplicationStatus,
  type ApplicationRecord,
  type ApplicationStatus,
} from "./application-record";

/**
 * Candidatures suivies (statut, note, rappel).
 *
 * - **Anonyme / Supabase non configuré** : stockées dans le navigateur.
 * - **Connecté** : table `applications` (RLS). L'ancien format (liste d'ids)
 *   est migré vers des fiches « postulé ».
 */
const KEY = "jobccq:applications";

let cache: Map<string, ApplicationRecord> | null = null;
let userId: string | null = null;
const listeners = new Set<() => void>();
const EMPTY_MAP: ReadonlyMap<string, ApplicationRecord> = new Map();

function read(): Map<string, ApplicationRecord> {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = parseApplicationStore(raw ? JSON.parse(raw) : []);
  } catch {
    cache = new Map();
  }
  return cache;
}

function write(next: Map<string, ApplicationRecord>): void {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(serializeApplicationStore(next)));
  } catch {
    /* stockage indisponible */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function rowPayload(rec: ApplicationRecord): Record<string, unknown> {
  return {
    user_id: userId,
    job_id: rec.jobId,
    status: rec.status,
    note: rec.note || null,
    remind_at: rec.remindAt || null,
  };
}

function persistRemote(rec: ApplicationRecord, prev?: ApplicationRecord): void {
  if (!userId || !supabase) return;
  const client = supabase;
  const full = rowPayload(rec);
  // Nouvelle date de rappel → le cron pourra renvoyer (même jour ou plus tard).
  if (prev && prev.remindAt !== rec.remindAt) full.remind_notified_at = null;
  client
    .from("applications")
    .upsert(full, { onConflict: "user_id,job_id" })
    .then(({ error }) => {
      if (!error) return;
      client
        .from("applications")
        .upsert({ user_id: userId, job_id: rec.jobId }, { onConflict: "user_id,job_id" })
        .then(({ error: e2 }) => e2 && console.warn("candidature non synchronisée :", e2.message));
    });
}

/** Marque/retire une offre comme suivie (optimiste + synchro si connecté). */
export function toggleApplied(id: string): void {
  const cur = read();
  if (cur.has(id)) {
    write(removeApplication(cur, id));
    if (userId && supabase) {
      supabase
        .from("applications")
        .delete()
        .eq("user_id", userId)
        .eq("job_id", id)
        .then(({ error }) => error && console.warn("candidature (retrait) non synchronisée :", error.message));
    }
    return;
  }
  const next = upsertApplication(cur, id, { status: "postule" });
  write(next);
  const rec = next.get(id);
  if (rec) persistRemote(rec);
}

export function patchApplication(id: string, patch: Partial<ApplicationRecord>): void {
  const cur = read();
  const prev = cur.get(id);
  const next = upsertApplication(cur, id, patch);
  write(next);
  const rec = next.get(id);
  if (rec) persistRemote(rec, prev);
}

async function onLogin(uid: string): Promise<void> {
  userId = uid;
  if (!supabase) return;
  const { data, error } = await supabase
    .from("applications")
    .select("job_id, status, note, remind_at")
    .eq("user_id", uid);
  if (error) {
    const fallback = await supabase.from("applications").select("job_id").eq("user_id", uid);
    if (fallback.error) {
      console.warn("Candidatures distantes illisibles :", fallback.error.message);
      return;
    }
    const remote = parseApplicationStore((fallback.data ?? []).map((r) => String((r as { job_id: string }).job_id)));
    mergeRemote(remote);
    return;
  }
  const remote = parseApplicationStore(
    Object.fromEntries(
      (data ?? []).map((r) => {
        const row = r as { job_id: string; status?: string; note?: string | null; remind_at?: string | null };
        return [
          String(row.job_id),
          {
            status: row.status,
            note: row.note ?? "",
            remindAt: row.remind_at ? String(row.remind_at).slice(0, 10) : "",
          },
        ];
      }),
    ),
  );
  mergeRemote(remote);
}

function mergeRemote(remote: Map<string, ApplicationRecord>): void {
  const local = read();
  const merged = new Map(remote);
  for (const [id, rec] of local) {
    if (!merged.has(id)) {
      merged.set(id, rec);
      persistRemote(rec);
    }
  }
  write(merged);
}

function onLogout(): void {
  userId = null;
}

if (typeof window !== "undefined" && supabase) {
  supabase.auth.getSession().then(({ data }) => {
    if (data.session?.user) void onLogin(data.session.user.id);
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) void onLogin(session.user.id);
    else onLogout();
  });
}

export function useApplicationRecords(): ReadonlyMap<string, ApplicationRecord> {
  return useSyncExternalStore(subscribe, read, () => EMPTY_MAP);
}

export function useApplications(): ReadonlySet<string> {
  const rec = useApplicationRecords();
  return useMemo(() => new Set(rec.keys()), [rec]);
}

export function useHasApplied(id: string): boolean {
  return useApplicationRecords().has(id);
}
