import { applyShardUpdate, planSnapshotFetch, type Job, type JobsManifest } from "@jobccq/shared";
import { matchSnapshotJson, putSnapshotResponse } from "./snapshot-cache.js";

export function snapshotUrls(basePath: string) {
  const root = `${basePath}/data`;
  return {
    manifest: `${root}/jobs.manifest.json`,
    full: `${root}/jobs.json`,
    shard: (key: string) => `${root}/jobs/r/${encodeURIComponent(key)}.json`,
  };
}

/**
 * Recharge l'instantané sans retélécharger ce qui n'a pas changé (idée 120).
 * `null` → le caller charge `jobs.json` en entier (première visite / repli).
 */
export async function loadJobsIncremental(basePath: string): Promise<Job[] | null> {
  const urls = snapshotUrls(basePath);
  const cachedMan = (await matchSnapshotJson<JobsManifest>(urls.manifest))?.data ?? null;
  const cachedJobs = (await matchSnapshotJson<Job[]>(urls.full))?.data ?? null;

  const res = await fetch(urls.manifest, { cache: "no-cache" });
  if (!res.ok) return null;
  const clone = res.clone();
  const live = (await res.json()) as JobsManifest;
  if (!live?.hash || !live.shards) return null;

  const plan = planSnapshotFetch(cachedMan, live);
  if (plan.kind === "reuse" && cachedJobs) {
    void putSnapshotResponse(urls.manifest, clone);
    return cachedJobs;
  }

  if (plan.kind === "shards" && cachedJobs && plan.keys.length) {
    const updates: Record<string, Job[]> = {};
    for (const key of plan.keys) {
      const sr = await fetch(urls.shard(key), { cache: "no-cache" });
      if (!sr.ok) return null;
      const sc = sr.clone();
      updates[key] = (await sr.json()) as Job[];
      void putSnapshotResponse(urls.shard(key), sc);
    }
    const merged = applyShardUpdate(cachedJobs, updates);
    void putSnapshotResponse(urls.full, new Response(JSON.stringify(merged), { status: 200 }));
    void putSnapshotResponse(urls.manifest, clone);
    return merged;
  }

  void putSnapshotResponse(urls.manifest, clone);
  return null;
}
