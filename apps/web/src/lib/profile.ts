"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  decideProfileSync,
  EMPTY_PROFILE,
  parseProfile,
  profileIsSet,
  type JobSeekerProfile,
} from "@jobccq/shared";
import { supabase } from "./supabase";

/**
 * Profil métier — métiers, régions, mobilité.
 *
 * - **Anonyme / Supabase non configuré** : stocké dans ce navigateur.
 * - **Connecté** : table `seeker_profiles` (RLS, une ligne par compte).
 *   À la connexion, on fusionne / prend la dernière écriture pour que le
 *   même profil suive sur tous les appareils.
 *
 * localStorage reste le cache immédiat (UI instantanée, hors-ligne).
 */
const KEY = "jobccq:profile";
const DISMISS_KEY = "jobccq:onboarding-dismissed";

let cache: JobSeekerProfile | null = null;
let cacheUpdatedAt = 0;
let userId: string | null = null;
const listeners = new Set<() => void>();

function readStored(): { profile: JobSeekerProfile; updatedAt: number } {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const at = Number(parsed?.updatedAt);
    return {
      profile: parseProfile(parsed),
      updatedAt: Number.isFinite(at) && at > 0 ? at : 0,
    };
  } catch {
    return { profile: { ...EMPTY_PROFILE }, updatedAt: 0 };
  }
}

function read(): JobSeekerProfile {
  if (cache) return cache;
  const stored = readStored();
  cache = stored.profile;
  cacheUpdatedAt = stored.updatedAt;
  return cache;
}

function write(next: JobSeekerProfile, updatedAt = Date.now()): void {
  cache = parseProfile(next);
  cacheUpdatedAt = updatedAt;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...cache, updatedAt }));
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

function persistRemote(profile: JobSeekerProfile, updatedAt: number): void {
  if (!userId || !supabase) return;
  supabase
    .from("seeker_profiles")
    .upsert(
      {
        user_id: userId,
        trades: profile.trades,
        regions: profile.regions,
        remote: profile.remote,
        updated_at: new Date(updatedAt).toISOString(),
      },
      { onConflict: "user_id" },
    )
    .then(({ error }) => error && console.warn("profil non synchronisé :", error.message));
}

export function saveProfile(next: JobSeekerProfile): JobSeekerProfile {
  const at = Date.now();
  write(next, at);
  persistRemote(read(), at);
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
  return read();
}

export function clearProfile(): void {
  const at = Date.now();
  write({ ...EMPTY_PROFILE }, at);
  persistRemote(read(), at);
}

export function isOnboardingDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissOnboarding(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

async function onLogin(uid: string): Promise<void> {
  userId = uid;
  if (!supabase) return;
  const { data, error } = await supabase
    .from("seeker_profiles")
    .select("trades, regions, remote, updated_at")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) {
    console.warn("Profil distant illisible (RLS/table ?) :", error.message);
    return;
  }
  const local = read();
  const localAt = cacheUpdatedAt;
  const remote = data ? parseProfile(data) : null;
  const remoteAt = data?.updated_at ? Date.parse(String(data.updated_at)) || 0 : 0;
  const decision = decideProfileSync({ local, localAt, remote, remoteAt });
  if (decision.action === "use-remote") {
    write(decision.profile, remoteAt || Date.now());
    return;
  }
  if (decision.action === "merge") {
    const at = Date.now();
    write(decision.profile, at);
    persistRemote(decision.profile, at);
    return;
  }
  if (decision.persistRemote) persistRemote(decision.profile, localAt || Date.now());
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

export function useProfile(): JobSeekerProfile {
  return useSyncExternalStore(subscribe, read, () => EMPTY_PROFILE);
}

export function useProfileIsSet(): boolean {
  return profileIsSet(useProfile());
}

export function useOnboardingDismissed(): boolean {
  const readDismissed = useCallback((): boolean => isOnboardingDismissed(), []);
  return useSyncExternalStore(
    subscribe,
    readDismissed,
    () => true, // SSR : ne pas afficher l'onboarding
  );
}
