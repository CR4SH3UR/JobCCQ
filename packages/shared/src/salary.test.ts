import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatSalary, toAnnual, toHourly } from "./salary.js";

describe("toAnnual / toHourly", () => {
  it("ramène 35 $/h à un annuel (35 h × 52 sem.)", () => {
    assert.equal(toAnnual(35, "heure"), 35 * 35 * 52);
  });

  it("ramène 63 700 $/an à un horaire", () => {
    assert.equal(toHourly(63_700, "annee"), Math.round(63_700 / (35 * 52)));
  });
});

describe("formatSalary", () => {
  it("affiche l'horaire et l'équivalent annuel", () => {
    const s = formatSalary({ salaryMin: 35, salaryPeriod: "heure" });
    assert.ok(s);
    assert.match(s!, /\/ heure/);
    assert.match(s!, /\/ an/);
    assert.match(s!, /35/);
  });

  it("affiche l'annuel et l'équivalent horaire", () => {
    const s = formatSalary({ salaryMin: 63_700, salaryPeriod: "annee" });
    assert.ok(s);
    assert.match(s!, /\/ an/);
    assert.match(s!, /\/ heure/);
  });

  it("retourne null sans salaire", () => {
    assert.equal(formatSalary({}), null);
  });
});
