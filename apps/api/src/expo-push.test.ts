import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatExpoPush } from "./expo-push.js";
import type { Job } from "@jobccq/shared";

const job = (title: string, id = title): Job =>
  ({
    id,
    sourceId: "pomerleau",
    url: "https://example.com/" + id,
    title,
    company: "Pomerleau",
    city: "Montréal",
    tags: [],
    languages: [],
    scrapedAt: "2026-01-01T00:00:00.000Z",
  }) as Job;

describe("formatExpoPush", () => {
  it("une offre : titre du poste dans le corps", () => {
    const p = formatExpoPush([job("Charpentier")], "Mes alertes");
    assert.equal(p.title, "JobCCQ — Mes alertes");
    assert.match(p.body, /Charpentier/);
    assert.match(p.body, /Pomerleau/);
    assert.equal(p.data?.jobId, "Charpentier");
  });

  it("plusieurs offres : compteur + aperçu", () => {
    const p = formatExpoPush([job("A", "a"), job("B", "b"), job("C", "c")], "Nouvelles offres");
    assert.match(p.body, /^3 nouvelles offres/);
    assert.match(p.body, /A · B · C/);
  });
});
