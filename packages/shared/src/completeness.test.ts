import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jobCompleteness } from "./completeness.js";
import type { Job } from "./types.js";

const base = {
  id: "j1",
  sourceId: "src",
  url: "https://example.com/j",
  title: "Électricien",
  company: "Acme",
  tags: [],
  languages: [],
  scrapedAt: "2026-01-02T00:00:00.000Z",
} as Job;

describe("jobCompleteness", () => {
  it("compte 0/5 quand rien n'est renseigné", () => {
    const c = jobCompleteness(base);
    assert.equal(c.score, 0);
    assert.equal(c.max, 5);
    assert.ok(c.missing.includes("salaire"));
    assert.ok(c.missing.includes("lieu"));
    assert.ok(c.missing.includes("description"));
  });

  it("compte les champs présents", () => {
    const c = jobCompleteness({
      ...base,
      salaryMin: 30,
      city: "Montréal",
      description: "x".repeat(80),
      employmentType: "temps-plein",
      postedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(c.score, 5);
    assert.deepEqual(c.missing, []);
  });
});
