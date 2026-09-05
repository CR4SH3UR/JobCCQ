"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  EMPTY_PROFILE,
  parseProfile,
  profileIsSet,
  type JobSeekerProfile,
} from "@jobccq/shared";

/**
 * Profil métier du visiteur — métiers, régions, mobilité.
 * Stocké **dans ce navigateur** (comme les recherches enregistrées). Aucun
 * compte requis ; fonctionne en mode statique.
 */
const KEY = "jobccq:profile";
const DISMISS_KEY = "jobccq:onboarding-dismissed";

let cache: JobSeekerProfile | null = null;
const listeners = new Set<() => void>();

function read(): JobSeekerProfile {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = parseProfile(raw ? JSON.parse(raw) : {});
  } catch {
    cache = { ...EMPTY_PROFILE };
  }
  return cache;
}

function write(next: JobSeekerProfile): void {
  cache = parseProfile(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
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

export function saveProfile(next: JobSeekerProfile): JobSeekerProfile {
  write(next);
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
  return read();
}

export function clearProfile(): void {
  write({ ...EMPTY_PROFILE });
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
