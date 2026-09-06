import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lastApplyClicksByJob, recentApplyClicksByJob, summarizeApplyClicks } from "./apply-clicks-stats.js";

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

describe("lastApplyClicksByJob", () => {
  it("garde le dernier clic Postuler par offre", () => {
    const last = lastApplyClicksByJob([
      { jobId: "a", sourceId: "pomerleau", title: "Charpentier", at: 10 },
      { jobId: "b", sourceId: "ebc", title: "Manœuvre", at: 20 },
      { jobId: "a", sourceId: "pomerleau", title: "Charpentier", at: 30 },
    ]);

    assert.equal(last.get("a"), 30);
    assert.equal(last.get("b"), 20);
  });
});

describe("recentApplyClicksByJob", () => {
  it("retourne une seule entrée par offre, triée par dernier clic", () => {
    const recent = recentApplyClicksByJob([
      { jobId: "a", sourceId: "pomerleau", title: "Charpentier", at: 10 },
      { jobId: "b", sourceId: "ebc", title: "Manœuvre", at: 40 },
      { jobId: "a", sourceId: "pomerleau", title: "Charpentier senior", at: 30 },
    ]);

    assert.deepEqual(
      recent.map((e) => [e.jobId, e.title, e.at]),
      [
        ["b", "Manœuvre", 40],
        ["a", "Charpentier senior", 30],
      ],
    );
  });
});
