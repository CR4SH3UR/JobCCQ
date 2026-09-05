import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rankHiringCompanies } from "./filters.js";
import type { Job } from "./types.js";

let seq = 0;
function job(extra: Partial<Job> & Pick<Job, "title" | "company">): Job {
  seq += 1;
  return {
    id: `j${seq}`,
    sourceId: extra.sourceId ?? extra.company.toLowerCase().replace(/\s+/g, "-"),
    url: `https://example.com/${seq}`,
    tags: [],
    languages: [],
    scrapedAt: "2026-01-02T00:00:00.000Z",
    ...extra,
  } as Job;
}

describe("rankHiringCompanies", () => {
  const jobs = [
    job({ title: "Électricien", company: "Alpha", regionId: "montreal", sourceId: "alpha" }),
    job({ title: "Électricien", company: "Alpha", regionId: "montreal", sourceId: "alpha" }),
    job({ title: "Électricien", company: "Beta", regionId: "montreal", sourceId: "beta" }),
    job({ title: "Charpentier", company: "Gamma", regionId: "monteregie", sourceId: "gamma" }),
  ];

  it("classe par nombre d'ouvertures dans une région", () => {
    const ranked = rankHiringCompanies(jobs, { regionId: "montreal" });
    assert.deepEqual(
      ranked.map((c) => [c.company, c.openings]),
      [
        ["Alpha", 2],
        ["Beta", 1],
      ],
    );
  });

  it("classe par métier CCQ", () => {
    const ranked = rankHiringCompanies(jobs, { tradeId: "electricien" });
    assert.equal(ranked[0]?.company, "Alpha");
    assert.equal(ranked[0]?.openings, 2);
    assert.ok(!ranked.some((c) => c.company === "Gamma"));
  });
});
