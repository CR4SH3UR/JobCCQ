import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_COST_BUDGET, evaluateCosts, formatCostReport } from "./cost-budget.js";

describe("evaluateCosts", () => {
  it("passe sous les plafonds", () => {
    const r = evaluateCosts({ jobsCount: 100, jobsJsonBytes: 1_000 });
    assert.equal(r.ok, true);
    assert.equal(r.breaches.length, 0);
  });

  it("signale un jobs.json trop gros", () => {
    const r = evaluateCosts({
      jobsCount: 10,
      jobsJsonBytes: DEFAULT_COST_BUDGET.jobsJsonBytes + 1,
    });
    assert.equal(r.ok, false);
    assert.equal(r.breaches[0]?.key, "jobsJsonBytes");
  });

  it("ignore les métriques absentes (Turso / Workers non configurés)", () => {
    const r = evaluateCosts({ jobsCount: 1, jobsJsonBytes: 10 });
    assert.equal(r.ok, true);
  });

  it("résume un rapport lisible", () => {
    const sample = { jobsCount: 20_000, jobsJsonBytes: 100 };
    const r = evaluateCosts(sample);
    const text = formatCostReport(sample, DEFAULT_COST_BUDGET, r.breaches);
    assert.match(text, /Offres : 20000/);
    assert.match(text, /dépassement/);
  });
});
