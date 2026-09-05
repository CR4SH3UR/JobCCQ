/**
 * Cache Cache Storage de l'instantané `jobs.json` (trop gros pour localStorage).
 * Horodatage dans localStorage pour la bannière « hors ligne ».
 */
const CACHE_NAME = "jobccq-snapshot-v1";
const SAVED_AT_KEY = "jobccq:snapshot-saved-at";

function canCache(): boolean {
  return typeof caches !== "undefined";
}

/** Mémorise la réponse HTTP de l'instantané (clone avant `res.json()`). */
export async function putSnapshotResponse(url: string, res: Response): Promise<void> {
  if (!canCache() || !res.ok) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(url, res);
    try {
      localStorage.setItem(SAVED_AT_KEY, new Date().toISOString());
    } catch {
      /* localStorage plein ou indisponible */
    }
  } catch {
    /* quota Cache Storage */
  }
}

export async function matchSnapshotJson<T>(url: string): Promise<{ data: T; savedAt?: string } | null> {
  if (!canCache()) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    if (!hit) return null;
    const data = (await hit.json()) as T;
    let savedAt: string | undefined;
    try {
      savedAt = localStorage.getItem(SAVED_AT_KEY) ?? undefined;
    } catch {
      savedAt = undefined;
    }
    return { data, savedAt };
  } catch {
    return null;
  }
}
