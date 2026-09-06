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

/** I/O injectable pour les tests (Cache Storage + fetch). */
export type JobsSnapshotIo = {
  matchJson: <T>(url: string) => Promise<{ data: T } | null>;
  putResponse: (url: string, res: Response) => Promise<void>;
  fetch: typeof fetch;
};

function defaultIo(): JobsSnapshotIo {
  return {
    matchJson: matchSnapshotJson,
    putResponse: putSnapshotResponse,
    fetch: (...args) => globalThis.fetch(...args),
  };
}

/**
 * Recharge l'instantané sans retélécharger ce qui n'a pas changé (idée 120).
 * `null` → le caller charge `jobs.json` en entier (première visite / repli).
 *
 * Le manifeste vivant n'est écrit en cache qu'après un reuse ou une fusion
 * réussie : sinon la visite suivante croirait l'empreinte à jour et garderait
 * un `jobs.json` périmé (shards disparus, fetch full encore en cours).
 */
export async function loadJobsIncremental(
  basePath: string,
  io: JobsSnapshotIo = defaultIo(),
): Promise<Job[] | null> {
  const urls = snapshotUrls(basePath);
  const cachedMan = (await io.matchJson<JobsManifest>(urls.manifest))?.data ?? null;
  const cachedJobs = (await io.matchJson<Job[]>(urls.full))?.data ?? null;

  const res = await io.fetch(urls.manifest, { cache: "no-cache" });
  if (!res.ok) return null;
  const clone = res.clone();
  const live = (await res.json()) as JobsManifest;
  if (!live?.hash || !live.shards) return null;

  const plan = planSnapshotFetch(cachedMan, live);
  if (plan.kind === "reuse" && cachedJobs) {
    await io.putResponse(urls.manifest, clone);
    return cachedJobs;
  }

  if (plan.kind === "shards" && cachedJobs && (plan.keys.length || plan.drop.length)) {
    const updates: Record<string, Job[]> = {};
    for (const key of plan.keys) {
      const sr = await io.fetch(urls.shard(key), { cache: "no-cache" });
      if (!sr.ok) return null;
      const sc = sr.clone();
      updates[key] = (await sr.json()) as Job[];
      await io.putResponse(urls.shard(key), sc);
    }
    const merged = applyShardUpdate(cachedJobs, updates, plan.drop);
    await io.putResponse(urls.full, new Response(JSON.stringify(merged), { status: 200 }));
    await io.putResponse(urls.manifest, clone);
    return merged;
  }

  return null;
}
