import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWeeklyReport } from "./weekly-report.js";
import type { Job } from "./types.js";

function job(title: string, extra: Partial<Job> = {}): Job {
  return {
    id: title,
    sourceId: extra.sourceId ?? "acme",
    url: "https://acme.ca/1",
    title,
    company: extra.company ?? "Acme",
    tags: [],
    languages: [],
    scrapedAt: extra.scrapedAt ?? "2026-09-01T00:00:00.000Z",
    ...extra,
  };
}

describe("weekly-report", () => {
  it("compte les offres des 7 derniers jours et le top employeurs", () => {
    const now = Date.parse("2026-09-06T12:00:00.000Z");
    const report = buildWeeklyReport(
      [
        job("Électricien neuf", {
          postedAt: "2026-09-05T00:00:00.000Z",
          company: "Hamel",
          sourceId: "hamel-construction",
          regionId: "montreal",
        }),
        job("Manœuvre neuf", {
          postedAt: "2026-09-04T00:00:00.000Z",
          company: "Hamel",
          sourceId: "hamel-construction",
          regionId: "montreal",
        }),
        job("Électricien vieux", {
          postedAt: "2026-08-01T00:00:00.000Z",
          company: "Autre",
          sourceId: "autre",
          regionId: "quebec",
        }),
      ],
      now,
    );
    assert.equal(report.days, 7);
    assert.equal(report.newJobs, 2);
    assert.equal(report.totalJobs, 3);
    assert.equal(report.topEmployers[0]?.label, "Hamel");
    assert.equal(report.topEmployers[0]?.count, 2);
    assert.equal(report.topRegions[0]?.id, "montreal");
    assert.equal(report.topTrades.some((t) => t.id === "electricien"), true);
  });
});
