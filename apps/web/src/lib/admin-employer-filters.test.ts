import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMissingCareersUrl, normalizeCareersUrl } from "./admin-employer-filters.js";

describe("admin-employer-filters — Sans URL", () => {
  it("détecte une URL carrières vide ou absente", () => {
    assert.equal(isMissingCareersUrl(""), true);
    assert.equal(isMissingCareersUrl("   "), true);
    assert.equal(isMissingCareersUrl(null), true);
    assert.equal(isMissingCareersUrl(undefined), true);
    assert.equal(isMissingCareersUrl("null"), true);
    assert.equal(isMissingCareersUrl("NULL"), true);
    assert.equal(isMissingCareersUrl("undefined"), true);
  });

  it("conserve une URL réelle", () => {
    assert.equal(isMissingCareersUrl("https://fenplast.com/carrieres"), false);
    assert.equal(isMissingCareersUrl("  https://a.example/jobs  "), false);
  });

  it("normalise null SQL / « null » texte vers une chaîne vide", () => {
    assert.equal(normalizeCareersUrl(null), "");
    assert.equal(normalizeCareersUrl("null"), "");
    assert.equal(normalizeCareersUrl("  https://a.example/jobs  "), "https://a.example/jobs");
  });
});
