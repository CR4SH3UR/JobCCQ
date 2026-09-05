import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeApplyClicks } from "./apply-clicks-stats.js";

describe("summarizeApplyClicks", () => {
  it("compte par offre et par source", () => {
    const stats = summarizeApplyClicks([
      { jobId: "a", sourceId: "pomerleau", title: "Charpentier", at: 1 },
      { jobId: "a", sourceId: "pomerleau", title: "Charpentier", at: 2 },
      { jobId: "b", sourceId: "ebc", title: "Manœuvre", at: 3 },
    ]);
    assert.equal(stats.total, 3);
    assert.equal(stats.byJob[0]?.jobId, "a");
    assert.equal(stats.byJob[0]?.count, 2);
    assert.equal(stats.bySource.find((s) => s.sourceId === "pomerleau")?.count, 2);
    assert.equal(stats.bySource.find((s) => s.sourceId === "ebc")?.count, 1);
  });

  it("liste vide", () => {
    const stats = summarizeApplyClicks([]);
    assert.equal(stats.total, 0);
    assert.equal(stats.byJob.length, 0);
  });
});
