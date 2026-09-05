import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jobsToCsv } from "./csv.js";
import type { Job } from "./types.js";

describe("jobsToCsv", () => {
  it("émet un en-tête même sans offres", () => {
    const csv = jobsToCsv([]);
    assert.equal(csv.split("\n")[0], "titre,entreprise,ville,region,url,fiche");
  });

  it("échappe les guillemets et virgules", () => {
    const job = {
      id: "ab,c",
      sourceId: "src",
      url: "https://example.com/job",
      title: 'Chef "équipe", chantier',
      company: "Acme & Fils",
      city: "Montréal",
      regionId: "montreal",
      tags: [],
      languages: [],
      scrapedAt: "2026-01-02T00:00:00.000Z",
    } as Job;
    const csv = jobsToCsv([job], { siteUrl: "https://jobccqc.ca" });
    assert.ok(csv.includes('"Chef ""équipe"", chantier"'));
    assert.ok(csv.includes("Acme & Fils"));
    assert.ok(csv.includes("https://jobccqc.ca/emplois/ab%2Cc/"));
  });
});
