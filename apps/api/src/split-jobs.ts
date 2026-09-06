/**
 * Découpe un jobs.json existant en shards région + manifeste (sans toucher à la BD).
 *
 *   npm run split:jobs -w @jobccq/api
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Job } from "@jobccq/shared";
import { writeJobShards } from "./write-job-shards.js";

const DATA = resolve(process.cwd(), "../web/public/data");

async function main() {
  const raw = await readFile(resolve(DATA, "jobs.json"), "utf8");
  const jobs = JSON.parse(raw) as Job[];
  const manifest = await writeJobShards(DATA, jobs);
  const n = Object.keys(manifest.shards).length;
  console.log(`✅ ${manifest.total} offres → ${n} shards (hash ${manifest.hash}).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
