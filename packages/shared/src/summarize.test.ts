import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeDescription } from "./summarize.js";

describe("summarizeDescription", () => {
  it("prend 2-3 puces d'une description à puces", () => {
    const text = `Nous recherchons un électricien de chantier.

- Installer et entretenir les systèmes électriques sur les chantiers de la région.
- Lire les plans et respecter le code de l'électricité du Québec.
- Encadrer un apprenti et coordonner avec les autres corps de métier.

Avantages : REER.`;
    const bullets = summarizeDescription(text);
    assert.equal(bullets.length, 3);
    assert.match(bullets[0] ?? "", /Installer/);
    assert.match(bullets[1] ?? "", /plans/);
    assert.match(bullets[2] ?? "", /apprenti/);
  });

  it("extrait les premières phrases substantielles sans puces", () => {
    const text =
      "Notre entreprise recrute un charpentier-menuisier pour des projets résidentiels à Laval. Vous travaillerez en équipe sur des ossatures bois et des finitions intérieures. Le poste est à temps plein, dès que possible. Salaire selon expérience.";
    const bullets = summarizeDescription(text);
    assert.ok(bullets.length >= 2 && bullets.length <= 3);
    assert.match(bullets[0] ?? "", /charpentier/i);
  });

  it("ne résume pas un texte trop court", () => {
    assert.deepEqual(summarizeDescription("Poste à pourvoir."), []);
    assert.deepEqual(summarizeDescription(""), []);
    assert.deepEqual(summarizeDescription(undefined), []);
  });
});
