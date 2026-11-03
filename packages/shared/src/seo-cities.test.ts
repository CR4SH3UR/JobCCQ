import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jobMatchesSeoCity, seoCityById } from "./seo-cities.js";

describe("seo-cities", () => {
  it("résout les slugs demandés (Laval, Gatineau, Lévis, Sherbrooke)", () => {
    assert.equal(seoCityById("laval")?.label, "Laval");
    assert.equal(seoCityById("gatineau")?.label, "Gatineau");
    assert.equal(seoCityById("levis")?.label, "Lévis");
    assert.equal(seoCityById("sherbrooke")?.label, "Sherbrooke");
  });

  it("matche city et le premier segment de location", () => {
    const levis = seoCityById("levis")!;
    assert.equal(jobMatchesSeoCity({ city: "Lévis" }, levis), true);
    assert.equal(jobMatchesSeoCity({ location: "Levis, QC" }, levis), true);
    assert.equal(jobMatchesSeoCity({ location: "Montréal, QC" }, levis), false);
  });

  it("reconnaît Hull comme alias de Gatineau", () => {
    const g = seoCityById("gatineau")!;
    assert.equal(jobMatchesSeoCity({ city: "Hull" }, g), true);
  });
});
