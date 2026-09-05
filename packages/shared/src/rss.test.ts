import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jobsToRss } from "./rss.js";
import type { Job } from "./types.js";

describe("jobsToRss", () => {
  it("échappe le XML et inclut titre + lien", () => {
    const job = {
      id: "abc",
      sourceId: "src",
      url: "https://example.com/job",
      title: "Électricien <senior> & cie",
      company: "Acme",
      tags: [],
      languages: [],
      scrapedAt: "2026-01-02T00:00:00.000Z",
      postedAt: "2026-01-02T00:00:00.000Z",
    } as Job;
    const xml = jobsToRss([job], {
      siteUrl: "https://jobccqc.ca",
      feedUrl: "https://jobccqc.ca/emplois.rss",
    });
    assert.ok(xml.includes("<rss version=\"2.0\""));
    assert.ok(xml.includes("Électricien &lt;senior&gt; &amp; cie"));
    assert.ok(xml.includes("https://jobccqc.ca/emplois/abc/"));
    assert.ok(!xml.includes("<senior>"));
  });

  it("plafonne à 50 items et trie du plus récent", () => {
    const jobs = Array.from({ length: 60 }, (_, i) => ({
      id: `j${i}`,
      sourceId: "src",
      url: `https://example.com/${i}`,
      title: `Poste ${i}`,
      company: "Acme",
      tags: [],
      languages: [],
      scrapedAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
    })) as Job[];
    const xml = jobsToRss(jobs, {
      siteUrl: "https://jobccqc.ca",
      feedUrl: "https://jobccqc.ca/emplois.rss",
    });
    const items = xml.match(/<item>/g) ?? [];
    assert.equal(items.length, 50);
    assert.ok(xml.includes("Poste 59"));
    assert.ok(!xml.includes("Poste 0"));
    assert.ok(!xml.includes("Poste 9"));
  });
});
