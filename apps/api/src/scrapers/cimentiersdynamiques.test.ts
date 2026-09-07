import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCimentiersDynamiques } from "./cimentiersdynamiques.js";

const BASE = "https://cimentiersdynamiques.com/index.php/carriere/";

const FIXTURE = `<html><body>
  <div class="module_column col-full">
    <h3 class="fancy-heading"><span class="main-head">NOS OFFRES D'EMPLOIS</span></h3>
    <div class="module_subrow">
      <div class="module_column">
        <div class="module-image">
          <h3 class="image-title">JOURNALIERS / JOURNALIÈRES</h3>
        </div>
        <div class="module-buttons">
          <a href="https://cimentiersdynamiques.com/index.php/journaliers/" class="ui builder_button">postulez</a>
        </div>
      </div>
      <div class="module_column">
        <div class="module-image">
          <h3 class="image-title">CHAUFFEURS / CHAUFFEUSES</h3>
          <div class="image-caption">CAMIONS-BENNES</div>
        </div>
        <div class="module-buttons">
          <a href="https://cimentiersdynamiques.com/index.php/chauffeurs-chauffeuses-camion/" class="ui builder_button">postulez</a>
        </div>
      </div>
      <div class="module_column">
        <div class="module-image">
          <h3 class="image-title">CHAUFFEURS / CHAUFFEUSES</h3>
          <div class="image-caption">BÉTONNIÈRES</div>
        </div>
        <div class="module-buttons">
          <a href="/index.php/chauffeurs-chauffeuses-betonnieres/" class="ui builder_button">postulez</a>
        </div>
      </div>
    </div>
  </div>
  <h3>UNE ÉQUIPE EN BÉTON !</h3>
</body></html>`;

describe("parseCimentiersDynamiques", () => {
  it("extrait les 3 cartes et distingue les deux postes chauffeur", () => {
    const jobs = parseCimentiersDynamiques(FIXTURE, BASE);
    assert.equal(jobs.length, 3);

    const journalier = jobs.find((j) => /journalier/i.test(j.title));
    assert.ok(journalier);
    assert.equal(journalier.company, "Cimentiers Dynamiques inc.");
    assert.equal(journalier.sourceId, "cimentiersdynamiques-com");
    assert.equal(journalier.location, "Saint-Jérôme, QC");
    assert.equal(journalier.url, "https://cimentiersdynamiques.com/index.php/journaliers/");
    assert.match(journalier.title, /Journaliers \/ Journalières/);
    assert.ok(!/camion/i.test(journalier.title));

    const bennes = jobs.find((j) => /camion/i.test(j.title));
    assert.ok(bennes);
    assert.equal(
      bennes.url,
      "https://cimentiersdynamiques.com/index.php/chauffeurs-chauffeuses-camion/",
    );
    assert.match(bennes.title, /Camions-Bennes/);

    const beton = jobs.find((j) => /b[ée]tonni/i.test(j.title));
    assert.ok(beton);
    assert.equal(
      beton.url,
      "https://cimentiersdynamiques.com/index.php/chauffeurs-chauffeuses-betonnieres/",
    );
    assert.ok(!jobs.some((j) => /équipe en béton/i.test(j.title)));
  });

  it("dédoublonne les mêmes URLs", () => {
    assert.equal(parseCimentiersDynamiques(`${FIXTURE}${FIXTURE}`, BASE).length, 3);
  });

  it("renvoie [] si aucune offre", () => {
    assert.deepEqual(parseCimentiersDynamiques("<html><body><h1>Carrière</h1></body></html>", BASE), []);
  });
});
