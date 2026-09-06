import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSalaryGuide, jobHourly, median, SALARY_GUIDE_MIN_SAMPLE } from "./salary-guide.js";
import type { Job } from "./types.js";

function job(title: string, extra: Partial<Job> = {}): Job {
  return {
    id: title,
    sourceId: "acme",
    url: "https://acme.ca/1",
    title,
    company: "Acme",
    tags: [],
    languages: [],
    scrapedAt: "2026-09-01T00:00:00.000Z",
    ...extra,
  };
}

describe("salary-guide", () => {
  it("médiane paire et impaire", () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([1, 2, 3, 4]), 2.5);
    assert.equal(median([]), undefined);
  });

  it("ramène un annuel à un horaire", () => {
    const h = jobHourly({ salaryMin: 72_800, salaryPeriod: "annee" });
    assert.ok(h != null && Math.abs(h - 40) < 0.01);
  });

  it("agrège grille CCQ + médiane si assez d'échantillons", () => {
    const jobs = [
      job("Électricien A", { salaryMin: 40, salaryPeriod: "heure", regionId: "montreal" }),
      job("Électricien B", { salaryMin: 50, salaryPeriod: "heure", regionId: "montreal" }),
      job("Électricien C", { salaryMin: 60, salaryPeriod: "heure", regionId: "montreal" }),
      job("Électricien D", { salaryMin: 45, salaryPeriod: "heure", regionId: "laval" }),
    ];
    const rows = buildSalaryGuide(jobs);
    const elec = rows.find((r) => r.tradeId === "electricien");
    assert.ok(elec);
    assert.equal(elec.ccqHourly, 50.79);
    assert.equal(elec.sample, 4);
    assert.equal(elec.observedMedian, 47.5);
    const mtl = elec.regions.find((r) => r.regionId === "montreal");
    assert.equal(mtl?.sample, 3);
    assert.equal(mtl?.median, 50);
    const lav = elec.regions.find((r) => r.regionId === "laval");
    assert.equal(lav?.sample, 1);
    assert.equal(lav?.median, undefined);
    assert.ok(elec.sample >= SALARY_GUIDE_MIN_SAMPLE);
  });
});
