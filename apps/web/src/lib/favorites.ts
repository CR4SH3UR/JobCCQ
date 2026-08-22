"use client";

import { useSyncExternalStore } from "react";

/**
 * Favoris « offres sauvegardées », stockés **dans le navigateur du visiteur**
 * (localStorage) — aucun compte, aucun serveur. On garde la liste des `id`
 * d'offres. Les favoris survivent au rafraîchissement et se synchronisent entre
 * les onglets (événement `storage`) et entre les composants d'un même onglet
 * (abonnés internes). Défaut assumé : pas de synchro entre appareils.
 */
const KEY = "jobccq:favorites";

let cache: Set<string> | null = null;
const listeners = new Set<() => void>();
const EMPTY: ReadonlySet<string> = new Set();

/** Lit (et met en cache) l'ensemble courant. Le cache garde une référence
 *  stable tant que rien ne change → compatible useSyncExternalStore. */
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
  cache = next; // nouvelle référence → les abonnés re-render
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    /* stockage indisponible (navigation privée, quota) */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null; // relit depuis le stockage (modifié dans un autre onglet)
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Ajoute/retire une offre des favoris. */
export function toggleFavorite(id: string): void {
  const next = new Set(read());
  next.has(id) ? next.delete(id) : next.add(id);
  write(next);
}

/** Ensemble réactif des id favoris (vide côté serveur / export statique). */
export function useFavorites(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** L'offre `id` est-elle en favori ? (réactif) */
export function useIsFavorite(id: string): boolean {
  return useFavorites().has(id);
}
