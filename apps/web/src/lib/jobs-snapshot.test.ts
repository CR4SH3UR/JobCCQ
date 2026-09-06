import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildManifest, type Job } from "@jobccq/shared";
import { loadJobsIncremental, snapshotUrls, type JobsSnapshotIo } from "./jobs-snapshot.js";

function job(id: string, regionId: string): Job {
  return {
    id,
    sourceId: "acme",
    url: `https://acme.ca/${id}`,
    title: id,
    company: "Acme",
    regionId,
    tags: [],
    languages: [],
    scrapedAt: "2026-01-01T00:00:00.000Z",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function memoryIo(opts: {
  cache: Map<string, unknown>;
  live: Map<string, unknown>;
  puts: string[];
}): JobsSnapshotIo {
  const urls = snapshotUrls("");
  return {
    matchJson: async <T>(url: string) => {
      if (!opts.cache.has(url)) return null;
      return { data: opts.cache.get(url) as T };
    },
    putResponse: async (url, res) => {
      opts.puts.push(url);
      if (res.ok) opts.cache.set(url, await res.clone().json());
    },
    fetch: async (input) => {
      const url = String(input);
      if (!opts.live.has(url)) return jsonResponse({ error: "missing" }, 404);
      if (url === urls.manifest) {
        return jsonResponse(opts.live.get(url));
      }
      return jsonResponse(opts.live.get(url));
    },
  };
}

describe("loadJobsIncremental", () => {
  it("retire les offres d'un shard disparu (montreal+laval → montreal)", async () => {
    const urls = snapshotUrls("");
    const cachedJobs = [job("m1", "montreal"), job("l1", "laval")];
    const liveJobs = [job("m1", "montreal")];
    const cache = new Map<string, unknown>([
      [urls.manifest, buildManifest(cachedJobs).manifest],
      [urls.full, cachedJobs],
    ]);
    const live = new Map<string, unknown>([[urls.manifest, buildManifest(liveJobs).manifest]]);
    const puts: string[] = [];

    const merged = await loadJobsIncremental("", memoryIo({ cache, live, puts }));
    assert.deepEqual(
      merged?.map((j) => j.id),
      ["m1"],
    );
    assert.ok(puts.includes(urls.full), "jobs.json fusionné avant le manifeste");
    assert.ok(puts.indexOf(urls.full) < puts.indexOf(urls.manifest));
    assert.deepEqual(
      (cache.get(urls.full) as Job[]).map((j) => j.id),
      ["m1"],
    );
  });

  it("n'écrit pas le manifeste vivant si le repli jobs.json est encore nécessaire", async () => {
    const urls = snapshotUrls("");
    const liveJobs = [job("m1", "montreal")];
    const cache = new Map<string, unknown>();
    const live = new Map<string, unknown>([[urls.manifest, buildManifest(liveJobs).manifest]]);
    const puts: string[] = [];

    const got = await loadJobsIncremental("", memoryIo({ cache, live, puts }));
    assert.equal(got, null);
    assert.deepEqual(puts, []);
  });

  it("n'écrit pas le manifeste si un shard changé est introuvable", async () => {
    const urls = snapshotUrls("");
    const cachedJobs = [job("m1", "montreal")];
    const liveJobs = [job("m2", "montreal")];
    const cache = new Map<string, unknown>([
      [urls.manifest, buildManifest(cachedJobs).manifest],
      [urls.full, cachedJobs],
    ]);
    const live = new Map<string, unknown>([[urls.manifest, buildManifest(liveJobs).manifest]]);
    const puts: string[] = [];

    const got = await loadJobsIncremental("", memoryIo({ cache, live, puts }));
    assert.equal(got, null);
    assert.equal(puts.includes(urls.manifest), false);
  });
});
