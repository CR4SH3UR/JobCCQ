"use client";

import { useSyncExternalStore } from "react";

/**
 * Entreprises suivies — liste d'identifiants d'employeurs (id de source) stockée
 * **dans ce navigateur** (localStorage). Aucune connexion requise ; fonctionne
 * dans tous les modes. L'envoi d'un courriel « quand l'entreprise publie » est
 * géré séparément par une alerte Supabase (voir FollowEmployerButton), tandis
 * que cette liste locale sert au repérage instantané (bouton « suivie »).
 */
const KEY = "jobccq:followed-companies";

let cache: Set<string> | null = null;
const listeners = new Set<() => void>();
const EMPTY: ReadonlySet<string> = new Set();

function read(): Set<string> {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

function write(next: Set<string>): void {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
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

/** Ajoute/retire une entreprise de la liste suivie (ce navigateur). */
export function toggleFollow(id: string): boolean {
  const next = new Set(read());
  const following = !next.has(id);
  following ? next.add(id) : next.delete(id);
  write(next);
  return following;
}

/** Ensemble réactif des id d'entreprises suivies (vide côté serveur / SSG). */
export function useFollowedCompanies(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** L'entreprise `id` est-elle suivie ? (réactif) */
export function useIsFollowing(id: string): boolean {
  return useFollowedCompanies().has(id);
}
