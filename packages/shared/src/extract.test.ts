import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractContacts, detectShift } from "./extract.js";

describe("extractContacts", () => {
  it("trouve courriel et téléphone publics", () => {
    const text = "Postulez à rh@acme-construction.ca ou au 514-555-1234.";
    const c = extractContacts(text);
    assert.deepEqual(c.emails, ["rh@acme-construction.ca"]);
    assert.deepEqual(c.phones, ["514-555-1234"]);
  });

  it("ignore les adresses factices", () => {
    const c = extractContacts("Contact placeholder@example.com");
    assert.deepEqual(c.emails, []);
  });
});

describe("detectShift", () => {
  it("détecte quart de nuit, soir et jour", () => {
    assert.equal(detectShift("Quart de nuit, 23 h à 7 h"), "nuit");
    assert.equal(detectShift("Horaire de soir, 16 h à minuit"), "soir");
    assert.equal(detectShift("Quart de jour uniquement"), "jour");
  });

  it("priorise la nuit si plusieurs quartiers sont mentionnés", () => {
    assert.equal(detectShift("Possibilité de jour ou de nuit"), "nuit");
  });

  it("retourne undefined sans indice", () => {
    assert.equal(detectShift("Électricien de chantier à Montréal"), undefined);
  });
});
