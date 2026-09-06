import { useSyncExternalStore } from "react";

const KEY = "jobccq:fav";
const listeners = new Set<() => void>();
let cache: Set<string> | null = null;

function read(): Set<string> {
  if (cache) return cache;
  cache = new Set();
  try {
    const g = globalThis as { localStorage?: { getItem: (k: string) => string | null } };
    const raw = g.localStorage?.getItem(KEY);
    if (raw) JSON.parse(raw).forEach((id: string) => cache!.add(id));
  } catch {
    /* native : pas de localStorage */
  }
  return cache;
}

function persist(s: Set<string>): void {
  cache = s;
  try {
    const g = globalThis as { localStorage?: { setItem: (k: string, v: string) => void } };
    g.localStorage?.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function toggleFavorite(id: string): void {
  const s = new Set(read());
  s.has(id) ? s.delete(id) : s.add(id);
  persist(s);
}

export function useFavoriteIds(): string[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => [...read()].join(","),
    () => "",
  ).split(",").filter(Boolean);
}

export function useIsFavorite(id: string): boolean {
  return useFavoriteIds().includes(id);
}
