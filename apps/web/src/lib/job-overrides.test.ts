import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Job } from "@jobccq/shared";
import {
  applyPatch,
  isHiddenFromPublic,
  isOffConstruction,
  publicJobs,
  type StoredPatch,
} from "./job-overrides.js";

function job(id: string, title = "Électricien"): Job {
  return {
    id,
    sourceId: "acme",
    url: `https://acme.ca/${id}`,
    title,
    company: "Acme",
    tags: [],
    languages: [],
    scrapedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("isOffConstruction", () => {
  it("est vrai seulement si le patch le pose explicitement", () => {
    assert.equal(isOffConstruction(undefined), false);
    assert.equal(isOffConstruction({}), false);
    assert.equal(isOffConstruction({ offConstruction: true }), true);
    assert.equal(isOffConstruction({ offConstruction: false }), false);
  });
});

describe("isHiddenFromPublic", () => {
  it("masque hors construction ou signalement", () => {
    assert.equal(isHiddenFromPublic(undefined), false);
    assert.equal(isHiddenFromPublic({ hidden: true }), true);
    assert.equal(isHiddenFromPublic({ offConstruction: true }), true);
  });
});

describe("publicJobs", () => {
  it("masque les offres flaggées hors construction", () => {
    const jobs = [job("a"), job("b"), job("c")];
    const overrides = new Map<string, StoredPatch>([
      ["b", { offConstruction: true, title: "Comptable" }],
      ["c", { title: "Plombier" }],
    ]);
    const out = publicJobs(jobs, overrides);
    assert.deepEqual(out.map((j) => j.id), ["a", "c"]);
    assert.equal(out[1]?.title, "Plombier");
  });

  it("masque aussi les offres cachées par un signalement", () => {
    const jobs = [job("a"), job("b")];
    const overrides = new Map<string, StoredPatch>([["b", { hidden: true }]]);
    assert.deepEqual(publicJobs(jobs, overrides).map((j) => j.id), ["a"]);
  });

  it("n'écrit pas le flag sur le modèle Job public", () => {
    const patched = applyPatch(job("x"), { title: "Chef de chantier", offConstruction: true });
    assert.equal(patched.title, "Chef de chantier");
    assert.equal("offConstruction" in patched, false);
  });
});
