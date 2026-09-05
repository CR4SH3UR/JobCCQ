import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractContacts, detectShift, extractRequirements, extractBenefits } from "./extract.js";

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

describe("extractRequirements", () => {
  it("détecte ASP Construction, carte de compétence et permis classe 1", () => {
    const text =
      "Exigences : ASP Construction obligatoire, carte de compétence CCQ, permis de conduire classe 1.";
    const ids = extractRequirements(text).map((x) => x.id);
    assert.ok(ids.includes("asp"));
    assert.ok(ids.includes("carte-competence"));
    assert.ok(ids.includes("permis-classe-1"));
  });

  it("détecte permis classe 3 et travail en hauteur", () => {
    const ids = extractRequirements(
      "Permis classe 3 requis. Travail en hauteur fréquent.",
    ).map((x) => x.id);
    assert.ok(ids.includes("permis-classe-3"));
    assert.ok(ids.includes("hauteur"));
  });

  it("ne flagge rien sans indice", () => {
    assert.deepEqual(extractRequirements("Électricien de chantier à Montréal"), []);
  });
});

describe("extractBenefits", () => {
  it("détecte REER, assurances et camion fourni", () => {
    const text = "Avantages : REER, assurances collectives, camion fourni.";
    const ids = extractBenefits(text).map((x) => x.id);
    assert.ok(ids.includes("reer"));
    assert.ok(ids.includes("assurances"));
    assert.ok(ids.includes("camion"));
  });

  it("ne flagge rien sans indice", () => {
    assert.deepEqual(extractBenefits("Électricien de chantier à Montréal"), []);
  });
});
