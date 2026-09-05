import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseConvair } from "./convair.js";

const FIXTURE = `
<!DOCTYPE html>
<html lang="fr">
<head><title>Carrière chez CON-V-AIR</title></head>
<body>
  <h2 class="elementor-heading-title">Liste des postes disponibles</h2>
  <div class="elementor-loop-container elementor-grid" role="list">
    <div data-elementor-type="loop-item" class="elementor elementor-7854 e-loop-item e-loop-item-8281 post-8281 offre-demploi type-offre-demploi status-publish hentry">
      <div class="elementor-element elementor-element-861b557 e-con-full e-flex e-con e-parent">
        <div class="elementor-element elementor-element-fceda1c elementor-widget elementor-widget-heading">
          <h3 class="elementor-heading-title elementor-size-default">
            <a href="https://www.con-v-air.com/offre-demploi/ingenieur-dapplication-aux-ventes/">Ingénieur d’application aux ventes</a>
          </h3>
        </div>
        <div class="elementor-element elementor-element-b2ec15d elementor-widget elementor-widget-button">
          <a class="elementor-button elementor-button-link elementor-size-sm" href="https://www.con-v-air.com/offre-demploi/ingenieur-dapplication-aux-ventes/">
            <span class="elementor-button-text">Postuler</span>
          </a>
        </div>
      </div>
    </div>
    <div data-elementor-type="loop-item" class="elementor elementor-7854 e-loop-item e-loop-item-6754 post-6754 offre-demploi type-offre-demploi status-publish hentry">
      <div class="elementor-element elementor-element-861b557 e-con-full e-flex e-con e-parent">
        <div class="elementor-element elementor-element-fceda1c elementor-widget elementor-widget-heading">
          <h3 class="elementor-heading-title elementor-size-default">
            <a href="https://www.con-v-air.com/offre-demploi/charge-de-projet/">Chargé de projet</a>
          </h3>
        </div>
        <div class="elementor-element elementor-element-b2ec15d elementor-widget elementor-widget-button">
          <a class="elementor-button elementor-button-link elementor-size-sm" href="https://www.con-v-air.com/offre-demploi/charge-de-projet/">
            <span class="elementor-button-text">Postuler</span>
          </a>
        </div>
      </div>
    </div>
    <div data-elementor-type="loop-item" class="elementor elementor-7854 e-loop-item e-loop-item-6932 post-6932 offre-demploi type-offre-demploi status-publish hentry">
      <div class="elementor-element elementor-element-861b557 e-con-full e-flex e-con e-parent">
        <div class="elementor-element elementor-element-fceda1c elementor-widget elementor-widget-heading">
          <h3 class="elementor-heading-title elementor-size-default">
            <a href="https://www.con-v-air.com/offre-demploi/assembleur-soudeur/">Assembleur-soudeur</a>
          </h3>
        </div>
        <div class="elementor-element elementor-element-b2ec15d elementor-widget elementor-widget-button">
          <a class="elementor-button elementor-button-link elementor-size-sm" href="https://www.con-v-air.com/offre-demploi/assembleur-soudeur/">
            <span class="elementor-button-text">Postuler</span>
          </a>
        </div>
      </div>
    </div>
    <div data-elementor-type="loop-item" class="elementor elementor-7854 e-loop-item e-loop-item-4941 post-4941 offre-demploi type-offre-demploi status-publish hentry">
      <div class="elementor-element elementor-element-861b557 e-con-full e-flex e-con e-parent">
        <div class="elementor-element elementor-element-fceda1c elementor-widget elementor-widget-heading">
          <h3 class="elementor-heading-title elementor-size-default">
            <a href="https://www.con-v-air.com/offre-demploi/magasinier-reception-expedition/">Magasinier réception/expédition</a>
          </h3>
        </div>
        <div class="elementor-element elementor-element-b2ec15d elementor-widget elementor-widget-button">
          <a class="elementor-button elementor-button-link elementor-size-sm" href="https://www.con-v-air.com/offre-demploi/magasinier-reception-expedition/">
            <span class="elementor-button-text">Postuler</span>
          </a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

const FIXTURE_NO_LINK = `
<!DOCTYPE html>
<html lang="fr">
<head><title>Carrière chez CON-V-AIR</title></head>
<body>
  <div class="elementor-loop-container elementor-grid" role="list">
    <div data-elementor-type="loop-item" class="e-loop-item">
      <div class="elementor-widget-heading">
        <h3 class="elementor-heading-title">Candidature spontanée</h3>
      </div>
    </div>
  </div>
</body>
</html>
`;

describe("parseConvair", () => {
  it("extrait les 4 postes depuis les cartes Elementor", () => {
    const jobs = parseConvair(FIXTURE);
    assert.equal(jobs.length, 4);

    const ingenieur = jobs.find((j) => j.title === "Ingénieur d’application aux ventes");
    assert.ok(ingenieur);
    assert.equal(ingenieur!.company, "CON-V-AIR");
    assert.equal(ingenieur!.sourceId, "con-v-air-com");
    assert.equal(
      ingenieur!.url,
      "https://www.con-v-air.com/offre-demploi/ingenieur-dapplication-aux-ventes/",
    );

    const magasinier = jobs.find((j) => j.title === "Magasinier réception/expédition");
    assert.ok(magasinier);
    assert.equal(
      magasinier!.url,
      "https://www.con-v-air.com/offre-demploi/magasinier-reception-expedition/",
    );
  });

  it("utilise un fragment basé sur le titre quand le lien est absent", () => {
    const jobs = parseConvair(FIXTURE_NO_LINK);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]!.title, "Candidature spontanée");
    assert.equal(
      jobs[0]!.url,
      "https://www.con-v-air.com/carrieres/#candidature-spontanee",
    );
  });
});
