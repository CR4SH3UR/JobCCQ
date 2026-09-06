import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { glossTitleToEn, looksEnglish } from "./translate-job.js";

describe("translate-job", () => {
  it("glose un intitulé français", () => {
    const g = glossTitleToEn("Charpentier-menuisier de chantier");
    assert.equal(g.changed, true);
    assert.match(g.text.toLowerCase(), /carpenter/);
  });

  it("laisse un titre anglais", () => {
    assert.equal(looksEnglish("Site supervisor for the job"), true);
    assert.equal(glossTitleToEn("Welder and operator").changed, false);
  });
});
