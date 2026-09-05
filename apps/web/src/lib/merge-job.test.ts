import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Job } from "@jobccq/shared";
import { mergeLiveJob, looksTruncatedExcerpt } from "./merge-job.js";

function job(description?: string): Job {
  return {
    id: "j1",
    sourceId: "acme",
    url: "https://acme.ca/1",
    title: "Électricien",
    company: "Acme",
    tags: [],
    languages: [],
    scrapedAt: "2026-01-01T00:00:00.000Z",
    description,
  };
}

describe("looksTruncatedExcerpt", () => {
  it("détecte l'extrait client de 240 car. terminé par une ellipse", () => {
    assert.equal(looksTruncatedExcerpt(`${"x".repeat(239)}…`), true);
    assert.equal(looksTruncatedExcerpt("Description complète sans ellipse."), false);
  });
});

describe("mergeLiveJob", () => {
  it("garde la description SSG complète si le live est l'extrait tronqué", () => {
    const full = "x".repeat(800);
    const excerpt = `${full.slice(0, 239)}…`;
    const out = mergeLiveJob(job(full), { ...job(excerpt), city: "Montréal" });
    assert.equal(out?.description, full);
    assert.equal(out?.city, "Montréal");
  });

  it("prend la description live si elle est plus complète (API / overlay admin)", () => {
    const excerpt = `${"x".repeat(239)}…`;
    const full = "Texte admin corrigé, beaucoup plus long que l'extrait. ".repeat(10);
    const out = mergeLiveJob(job(excerpt), job(full));
    assert.equal(out?.description, full);
  });
});
