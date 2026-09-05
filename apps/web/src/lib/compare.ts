"use client";

import { useSyncExternalStore } from "react";

export const COMPARE_MAX = 3;
const KEY = "jobccq:compare";
const EMPTY: readonly string[] = [];

let cache: string[] | null = null;
const listeners = new Set<() => void>();

/** Ids d'offres à comparer (query `ids=a,b,c` ou liste). */
export function parseCompareIds(raw: string | string[] | null | undefined): string[] {
  const src = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of src.split(/[,+\s]+/)) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= COMPARE_MAX) break;
  }
  return out;
}

/** Ajoute ou retire un id. `rejected` si on tente un 4e. */
export function toggleCompareList(ids: readonly string[], id: string): { ids: string[]; rejected?: boolean } {
  if (ids.includes(id)) return { ids: ids.filter((x) => x !== id) };
  if (ids.length >= COMPARE_MAX) return { ids: [...ids], rejected: true };
  return { ids: [...ids, id] };
}

function read(): string[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = parseCompareIds(raw ? (JSON.parse(raw) as unknown as string[]).join(",") : "");
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: string[]): void {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
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

export function useCompareIds(): readonly string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function useIsCompared(id: string): boolean {
  return useCompareIds().includes(id);
}

export function toggleCompare(id: string): { rejected?: boolean } {
  const r = toggleCompareList(read(), id);
  write(r.ids);
  return r.rejected ? { rejected: true } : {};
}

export function removeCompare(id: string): void {
  write(read().filter((x) => x !== id));
}

export function clearCompare(): void {
  write([]);
}

export function compareHref(ids: readonly string[] = read()): string {
  const q = ids.length ? `?ids=${ids.map(encodeURIComponent).join(",")}` : "";
  return `/emplois/comparer/${q}`;
}
