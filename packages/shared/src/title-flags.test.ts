import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { displayJobTitle, flagWeirdTitle } from "./title-flags.js";

describe("flagWeirdTitle", () => {
  it("laisse passer un vrai métier", () => {
    assert.equal(flagWeirdTitle("Électricien de chantier — Montréal"), null);
    assert.equal(flagWeirdTitle("CHARPENTIER-MENUISIER"), null);
  });

  it("signale spam, clickbait et titre trop court", () => {
    assert.equal(flagWeirdTitle("URGENT!!! $$$ CLIQUEZ ICI")?.id, "spam");
    assert.equal(flagWeirdTitle("Argent facile à la maison")?.id, "clickbait");
    assert.equal(flagWeirdTitle("AB")?.id, "court");
    assert.equal(flagWeirdTitle("https://arnaque.example/job")?.id, "url");
    assert.equal(flagWeirdTitle("lorem ipsum chantier")?.id, "placeholder");
    assert.equal(flagWeirdTitle("Emploi 🚀💰 chantier")?.id, "emoji");
    assert.equal(flagWeirdTitle("Mécanicien d&#39;engins de chantier")?.id, "entites");
    assert.equal(flagWeirdTitle("Soudeur d&apos;acier")?.id, "entites");
  });
});

describe("displayJobTitle", () => {
  it("décode d&#39; et les entités nommées", () => {
    assert.equal(displayJobTitle("Mécanicien d&#39;engins de chantier"), "Mécanicien d'engins de chantier");
    assert.equal(displayJobTitle("Chef d&apos;équipe"), "Chef d'équipe");
  });
});
