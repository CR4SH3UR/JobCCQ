import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBetonGl } from "./betongl.js";

const FIXTURE = `
<div class="wp-block-group">
  <h2 class="wp-block-heading">POSTES DISPONIBLES</h2>

  <div class="wp-block-columns">
    <div class="wp-block-column" style="flex-basis:39%">
      <p class="has-olive-green-color has-text-color has-link-color has-rawlineextrabold-font-family wp-elements-1 wp-block-paragraph">
        <a href="https://betongl.com/carrieres/charge-e-de-projets/"><strong>CHARGÉ.E DE PROJETS</strong></a>
      </p>
    </div>
    <div class="wp-block-column" style="flex-basis:27%">
      <p class="wp-block-paragraph">Drummondville</p>
    </div>
    <div class="wp-block-column" style="flex-basis:23%">
      <p class="wp-block-paragraph">Temps plein</p>
    </div>
    <div class="wp-block-column">
      <p class="has-olive-green-color has-text-color has-link-color wp-elements-2 wp-block-paragraph">
        <a href="https://betongl.com/carrieres/charge-e-de-projets/">Détails</a>
      </p>
    </div>
  </div>

  <div class="wp-block-columns">
    <div class="wp-block-column" style="flex-basis:39%">
      <p class="wp-block-paragraph">
        <a href="/carrieres/manoeuvre/"><strong>MANOEUVRE</strong></a>
      </p>
    </div>
    <div class="wp-block-column" style="flex-basis:27%">
      <p class="wp-block-paragraph">Drummondville</p>
    </div>
    <div class="wp-block-column" style="flex-basis:23%">
      <p class="wp-block-paragraph">Temps plein</p>
    </div>
    <div class="wp-block-column">
      <p class="wp-block-paragraph">
        <a href="/carrieres/manoeuvre/">Détails</a>
      </p>
    </div>
  </div>

  <div class="wp-block-columns">
    <div class="wp-block-column" style="flex-basis:39%">
      <p class="wp-block-paragraph">
        <a href="/carrieres/secretaire/"><strong>SECRÉTAIRE</strong></a>
      </p>
    </div>
    <div class="wp-block-column" style="flex-basis:27%">
      <p class="wp-block-paragraph">Drummondville</p>
    </div>
    <div class="wp-block-column" style="flex-basis:23%">
      <p class="wp-block-paragraph">Temps plein</p>
    </div>
    <div class="wp-block-column">
      <p class="wp-block-paragraph">
        <a href="/carrieres/secretaire/">Détails</a>
      </p>
    </div>
  </div>
</div>
`;

describe("parseBetonGl", () => {
  it("extrait titre, lieu, type d'emploi et URL absolue de chaque ligne", () => {
    const jobs = parseBetonGl(FIXTURE);
    assert.equal(jobs.length, 3);

    assert.equal(jobs[0]!.title, "CHARGÉ.E DE PROJETS");
    assert.equal(jobs[0]!.location, "Drummondville");
    assert.equal(jobs[0]!.employmentType, "temps-plein");
    assert.equal(jobs[0]!.url, "https://betongl.com/carrieres/charge-e-de-projets/");

    assert.equal(jobs[1]!.title, "MANOEUVRE");
    assert.equal(jobs[1]!.url, "https://betongl.com/carrieres/manoeuvre/");

    assert.equal(jobs[2]!.title, "SECRÉTAIRE");
    assert.equal(jobs[2]!.url, "https://betongl.com/carrieres/secretaire/");
  });

  it("renvoie un tableau vide s'il n'y a pas de section POSTES DISPONIBLES", () => {
    assert.deepEqual(parseBetonGl("<html><body></body></html>"), []);
  });
});
