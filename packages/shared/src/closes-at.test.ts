import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractClosesAt } from "./closes-at.js";

describe("extractClosesAt", () => {
  it("lit une date ISO avec contexte", () => {
    assert.equal(extractClosesAt("Date limite : 2026-09-20. Postulez vite."), "2026-09-20");
  });

  it("lit JJ/MM/AAAA", () => {
    assert.equal(extractClosesAt("Postuler avant le 15/10/2026"), "2026-10-15");
  });

  it("lit un mois en français", () => {
    assert.equal(extractClosesAt("Candidatures avant le 3 novembre 2026"), "2026-11-03");
  });

  it("ignore un texte sans indice de date limite", () => {
    assert.equal(extractClosesAt("Électricien à Montréal, publié le 2026-01-01"), null);
  });
});
