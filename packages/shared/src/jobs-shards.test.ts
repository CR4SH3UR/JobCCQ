import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyShardUpdate,
  buildManifest,
  hashText,
  NONE_SHARD,
  planSnapshotFetch,
  shardKey,
  splitJobsByRegion,
} from "./jobs-shards.js";

const j = (id: string, regionId?: string) => ({ id, regionId });

describe("jobs-shards", () => {
  it("classe sans région dans _none", () => {
    assert.equal(shardKey(undefined), NONE_SHARD);
    assert.equal(shardKey("  "), NONE_SHARD);
    assert.equal(shardKey("montreal"), "montreal");
  });

  it("découpe puis fusionne un delta de shards", () => {
    const jobs = [j("a", "montreal"), j("b", "laval"), j("c")];
    const shards = splitJobsByRegion(jobs);
    assert.equal(shards.montreal?.length, 1);
    assert.equal(shards[NONE_SHARD]?.length, 1);

    const next = applyShardUpdate(jobs, {
      montreal: [j("a2", "montreal"), j("d", "montreal")],
    });
    const ids = next.map((x) => x.id).sort();
    assert.deepEqual(ids, ["a2", "b", "c", "d"]);
  });

  it("planifie reuse / shards / full selon le manifeste", () => {
    const { manifest } = buildManifest([j("a", "montreal"), j("b", "laval")]);
    assert.equal(planSnapshotFetch(null, manifest).kind, "full");
    assert.equal(planSnapshotFetch(manifest, manifest).kind, "reuse");

    const { manifest: next } = buildManifest([j("a", "montreal"), j("c", "laval")]);
    const plan = planSnapshotFetch(manifest, next);
    assert.equal(plan.kind, "shards");
    if (plan.kind === "shards") assert.deepEqual(plan.keys, ["laval"]);
  });

  it("hashText est stable", () => {
    assert.equal(hashText("abc"), hashText("abc"));
    assert.notEqual(hashText("abc"), hashText("abd"));
  });
});
