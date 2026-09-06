import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeScraperMetrics, type ScrapeRunLite } from "./scraper-metrics.js";

const run = (sourceId: string, status: string, extra: Partial<ScrapeRunLite> = {}): ScrapeRunLite => ({
  sourceId,
  status,
  ...extra,
});

describe("computeScraperMetrics", () => {
  it("calcule taux de succès, durée moyenne et tendance par source", () => {
    const runs: ScrapeRunLite[] = [
      run("a", "success", { found: 3, startedAt: "2026-01-01T00:00:00Z", finishedAt: "2026-01-01T00:00:10Z" }),
      run("a", "error", { found: 0, startedAt: "2026-01-02T00:00:00Z", finishedAt: "2026-01-02T00:00:20Z" }),
      run("a", "success", { found: 5, startedAt: "2026-01-03T00:00:00Z", finishedAt: "2026-01-03T00:00:30Z" }),
      run("b", "success", { found: 1, startedAt: "2026-01-01T00:00:00Z", finishedAt: "2026-01-01T00:00:05Z" }),
    ];
    const m = computeScraperMetrics(runs);
    assert.equal(m.totalRuns, 4);
    assert.equal(m.successRate, 3 / 4);

    // « a » est plus fragile (2/3) que « b » (1/1) → trié en premier.
    assert.deepEqual(m.sources.map((s) => s.sourceId), ["a", "b"]);
    const a = m.sources[0]!;
    assert.equal(a.runs, 3);
    assert.equal(a.successes, 2);
    assert.equal(a.errors, 1);
    assert.equal(a.successRate, 2 / 3);
    assert.equal(a.avgDurationMs, 20_000); // (10 + 20 + 30) / 3 s
    assert.deepEqual(a.volumeTrend, [3, 0, 5]); // ordre chronologique
    assert.equal(a.lastStatus, "success");
    assert.equal(a.lastAt, "2026-01-03T00:00:30Z");
  });

  it("durée nulle si run non terminé ; volume 0 si absent", () => {
    const m = computeScraperMetrics([
      run("x", "running", { startedAt: "2026-01-01T00:00:00Z" }),
    ]);
    const x = m.sources[0]!;
    assert.equal(x.avgDurationMs, null);
    assert.deepEqual(x.volumeTrend, [0]);
    assert.equal(x.successRate, 0);
  });

  it("liste vide → métriques vides", () => {
    const m = computeScraperMetrics([]);
    assert.equal(m.totalRuns, 0);
    assert.equal(m.successRate, 0);
    assert.deepEqual(m.sources, []);
  });
});
