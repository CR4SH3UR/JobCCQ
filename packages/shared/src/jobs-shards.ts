/**
 * Instantané offres découpé par région + plan de rechargement incrémental
 * (idée 120). Le fichier unique `jobs.json` reste le repli première visite.
 */

export const NONE_SHARD = "_none";

/** Clef de shard : région, ou `_none` si absente. */
export function shardKey(regionId?: string | null): string {
  const id = (regionId ?? "").trim();
  return id || NONE_SHARD;
}

export type JobsShardInfo = {
  hash: string;
  count: number;
  bytes: number;
};

export type JobsManifest = {
  generatedAt: string;
  total: number;
  /** Empreinte de l'instantané client complet. */
  hash: string;
  bytes: number;
  shards: Record<string, JobsShardInfo>;
};

/** Hash FNV-1a 32 bits (assez pour détecter un changement de shard). */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function splitJobsByRegion<T extends { regionId?: string }>(jobs: T[]): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const job of jobs) {
    const key = shardKey(job.regionId);
    (out[key] ??= []).push(job);
  }
  return out;
}

/** Remplace dans le cache les shards dont on a une nouvelle copie. */
export function applyShardUpdate<T extends { regionId?: string }>(
  cached: T[],
  updates: Record<string, T[]>,
): T[] {
  const changed = new Set(Object.keys(updates));
  const kept = cached.filter((j) => !changed.has(shardKey(j.regionId)));
  return [...kept, ...Object.values(updates).flat()];
}

export function buildManifest<T extends { regionId?: string }>(
  jobs: T[],
  generatedAt = new Date().toISOString(),
): { manifest: JobsManifest; shards: Record<string, T[]>; fullJson: string } {
  const shards = splitJobsByRegion(jobs);
  const fullJson = JSON.stringify(jobs);
  const info: Record<string, JobsShardInfo> = {};
  for (const [key, list] of Object.entries(shards)) {
    const json = JSON.stringify(list);
    info[key] = { hash: hashText(json), count: list.length, bytes: json.length };
  }
  return {
    shards,
    fullJson,
    manifest: {
      generatedAt,
      total: jobs.length,
      hash: hashText(fullJson),
      bytes: fullJson.length,
      shards: info,
    },
  };
}

/**
 * Au-delà de ce nombre de shards changés, un seul `jobs.json` est moins cher
 * que N petits GET.
 */
export const SHARD_FETCH_MAX = 8;

export type SnapshotFetchPlan =
  | { kind: "reuse" }
  | { kind: "shards"; keys: string[] }
  | { kind: "full" };

/** Compare le manifeste vivant au cache : rien / quelques shards / tout. */
export function planSnapshotFetch(cached: JobsManifest | null, live: JobsManifest): SnapshotFetchPlan {
  if (!cached) return { kind: "full" };
  if (cached.hash === live.hash) return { kind: "reuse" };
  const keys = Object.keys(live.shards).filter((k) => cached.shards[k]?.hash !== live.shards[k]?.hash);
  const removed = Object.keys(cached.shards).filter((k) => !(k in live.shards));
  const changed = [...new Set([...keys, ...removed])];
  if (changed.length === 0) return { kind: "reuse" };
  if (changed.length > SHARD_FETCH_MAX) return { kind: "full" };
  return { kind: "shards", keys: keys.filter((k) => k in live.shards) };
}
