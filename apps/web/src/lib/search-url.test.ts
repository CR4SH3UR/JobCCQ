import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filtersToQueryString,
  hasActiveFilters,
  parseFilters,
  parseFiltersFromQueryString,
  EMPTY_FILTERS,
} from "./search-url.js";

describe("search-url — codec des filtres", () => {
  it("décode les paramètres d'URL (compat : cities → ville unique)", () => {
    const f = parseFilters(
      new URLSearchParams("q=charpentier&cities=Montréal&regions=montreal,laval&ccqOnly=1&sort=salary_desc&page=3"),
    );
    assert.equal(f.q, "charpentier");
    assert.equal(f.city, "Montréal");
    assert.deepEqual(f.regions, ["montreal", "laval"]);
    assert.equal(f.ccqOnly, true);
    assert.equal(f.sort, "salary_desc");
    assert.equal(f.page, 3);
  });

  it("ignore un tri inconnu et une page ≤ 1", () => {
    const f = parseFilters(new URLSearchParams("sort=bidon&page=1"));
    assert.equal(f.sort, "recent");
    assert.equal(f.page, 1);
  });

  it("n'encode que les champs renseignés (tri par défaut/page 1 omis)", () => {
    assert.equal(filtersToQueryString(EMPTY_FILTERS), "");
    const qs = filtersToQueryString({ ...EMPTY_FILTERS, q: "soudeur", page: 1, sort: "recent" });
    assert.equal(qs, "q=soudeur");
  });

  it("aller-retour stable (query string → filtres → query string)", () => {
    const qs = "q=grutier&cities=Laval&categories=construction&salaryMin=60000&sort=company&page=2";
    assert.equal(filtersToQueryString(parseFiltersFromQueryString(qs)), qs);
  });

  it("hasActiveFilters détecte les critères actifs (hors tri/pagination)", () => {
    assert.equal(hasActiveFilters(EMPTY_FILTERS), false);
    assert.equal(hasActiveFilters({ ...EMPTY_FILTERS, sort: "company", page: 4 }), false);
    assert.equal(hasActiveFilters({ ...EMPTY_FILTERS, q: "peintre" }), true);
    assert.equal(hasActiveFilters({ ...EMPTY_FILTERS, regions: ["laval"] }), true);
    assert.equal(hasActiveFilters({ ...EMPTY_FILTERS, salaryListed: true }), true);
    assert.equal(hasActiveFilters({ ...EMPTY_FILTERS, shifts: ["nuit"] }), true);
  });
});
