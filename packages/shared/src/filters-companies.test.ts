import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isHiringCompanyDisabled } from "./filters.js";

const off = new Set(["off-1", "off-2"]);

describe("isHiringCompanyDisabled", () => {
  it("est fausse si une source reste active", () => {
    assert.equal(isHiringCompanyDisabled({ sources: ["off-1", "on-1"] }, off), false);
  });

  it("est vraie si toutes les sources sont désactivées", () => {
    assert.equal(isHiringCompanyDisabled({ sources: ["off-1", "off-2"] }, off), true);
  });

  it("est fausse sans source", () => {
    assert.equal(isHiringCompanyDisabled({ sources: [] }, off), false);
  });
});
