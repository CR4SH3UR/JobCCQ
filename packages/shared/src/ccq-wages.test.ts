import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ccqWageForJob, formatCcqHourly } from "./ccq-wages.js";

describe("ccqWageForJob", () => {
  it("taux compagnon ICI pour un métier connu", () => {
    const w = ccqWageForJob("Charpentier-menuisier");
    assert.equal(w?.tradeId, "charpentier-menuisier");
    assert.equal(w?.hourly, 50.16);
    assert.equal(w?.vsOffer, undefined);
  });

  it("compare une offre horaire à la grille", () => {
    const below = ccqWageForJob("Électricien", { salaryMin: 40, salaryPeriod: "heure" });
    assert.equal(below?.vsOffer, "below");
    const near = ccqWageForJob("Électricien", { salaryMin: 50.79, salaryPeriod: "heure" });
    assert.equal(near?.vsOffer, "near");
    const above = ccqWageForJob("Électricien", { salaryMin: 60, salaryPeriod: "heure" });
    assert.equal(above?.vsOffer, "above");
  });

  it("note chantiers isolés au Nord-du-Québec", () => {
    const w = ccqWageForJob("Manœuvre", { regionId: "nord-du-quebec" });
    assert.equal(w?.isolatedNote, true);
    assert.equal(w?.hourly, 40.19);
  });

  it("pas de taux pour un métier hors grille", () => {
    assert.equal(ccqWageForJob("Commis de bureau"), undefined);
    assert.equal(ccqWageForJob("Contremaître de chantier"), undefined);
  });

  it("format fr-CA", () => {
    assert.match(formatCcqHourly(50.16), /50,16/);
  });
});
