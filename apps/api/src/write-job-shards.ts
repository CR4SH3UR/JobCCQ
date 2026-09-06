/**
 * Écrit le manifeste + les shards région à côté de jobs.json (idée 120).
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildManifest, type Job, type JobsManifest } from "@jobccq/shared";

export async function writeJobShards(publicDataDir: string, jobs: Job[]): Promise<JobsManifest> {
  const { manifest, shards } = buildManifest(jobs);
  const shardDir = join(publicDataDir, "jobs", "r");
  await rm(shardDir, { recursive: true, force: true });
  await mkdir(shardDir, { recursive: true });
  for (const [key, list] of Object.entries(shards)) {
    await writeFile(join(shardDir, `${key}.json`), JSON.stringify(list));
  }
  await writeFile(join(publicDataDir, "jobs.manifest.json"), JSON.stringify(manifest));
  return manifest;
}
