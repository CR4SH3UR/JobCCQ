/**
 * Chargement avec repli sur un cache local : si le réseau échoue, on sert
 * la dernière copie réussie (même instantané `jobs.json` que le site statique).
 */
export type OfflineLoad<T> = {
  data: T;
  fromCache: boolean;
  savedAt?: string;
};

export type OfflineMeta = { fromCache: boolean; savedAt?: string };

const EMPTY: OfflineMeta = { fromCache: false };
let meta: OfflineMeta = EMPTY;
const listeners = new Set<() => void>();

export function getOfflineMeta(): OfflineMeta {
  return meta;
}

export function subscribeOfflineMeta(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setOfflineMeta(next: OfflineMeta): void {
  meta = next.fromCache ? next : EMPTY;
  listeners.forEach((l) => l());
}

export async function fetchWithOfflineFallback<T>(opts: {
  live: () => Promise<T>;
  readCache: () => Promise<{ data: T; savedAt?: string } | null>;
  writeCache: (data: T) => Promise<void>;
}): Promise<OfflineLoad<T>> {
  try {
    const data = await opts.live();
    try {
      await opts.writeCache(data);
    } catch {
      /* quota / Cache API indisponible */
    }
    return { data, fromCache: false };
  } catch (err) {
    const hit = await opts.readCache();
    if (hit) return { data: hit.data, fromCache: true, savedAt: hit.savedAt };
    throw err;
  }
}
