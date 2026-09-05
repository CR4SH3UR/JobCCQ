import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fsaOf, looksLikePostal, regionForFsa, resolveNearMe } from "./postal.js";
import type { Municipality } from "./municipalities.js";

describe("postal — FSA", () => {
  it("normalise un code postal canadien en FSA", () => {
    assert.equal(fsaOf("h2x 1y4"), "H2X");
    assert.equal(fsaOf("H7A-1B2"), "H7A");
    assert.equal(looksLikePostal("G1R 4P5"), true);
    assert.equal(looksLikePostal("Montréal"), false);
  });

  it("associe les grandes agglomérations à la bonne région", () => {
    assert.equal(regionForFsa("H2X"), "montreal");
    assert.equal(regionForFsa("H7A"), "laval");
    assert.equal(regionForFsa("G1R"), "capitale-nationale");
    assert.equal(regionForFsa("J4K"), "monteregie"); // Longueuil
    assert.equal(regionForFsa("J8X"), "outaouais"); // Gatineau
    assert.equal(regionForFsa("J1H"), "estrie"); // Sherbrooke
    assert.equal(regionForFsa("G9A"), "mauricie"); // Trois-Rivières
    assert.equal(regionForFsa("G7H"), "saguenay-lac-saint-jean");
    assert.equal(regionForFsa("G7A"), "chaudiere-appalaches"); // Lévis / Saint-Nicolas
  });

  it("classe un FSA hors Québec en canada-autre", () => {
    assert.equal(regionForFsa("M5V"), "canada-autre");
    assert.equal(regionForFsa("K1A"), "canada-autre");
  });
});

describe("resolveNearMe", () => {
  const towns: Municipality[] = [
    { name: "Longueuil", regionId: "monteregie" },
    { name: "Québec", regionId: "capitale-nationale" },
    { name: "Saint-Donat", regionId: "lanaudiere" },
  ];

  it("résout un code postal", () => {
    const h = resolveNearMe("H2X 1Y4", towns);
    assert.equal(h?.via, "postal");
    assert.equal(h?.fsa, "H2X");
    assert.equal(h?.regionId, "montreal");
  });

  it("résout une ville via l'index des municipalités", () => {
    const h = resolveNearMe("longueuil", towns);
    assert.equal(h?.via, "city");
    assert.equal(h?.city, "Longueuil");
    assert.equal(h?.regionId, "monteregie");
  });

  it("renvoie null si rien n'est reconnu", () => {
    assert.equal(resolveNearMe("xyzzy", towns), null);
    assert.equal(resolveNearMe("  ", towns), null);
  });
});
