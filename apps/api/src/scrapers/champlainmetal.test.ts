import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseChamplainMetal } from "./champlainmetal.js";

const BASE = "https://champlainmetal.com/carrieres/";

/** Extrait Elementor : 2 postes en accordéon + un titre de section. */
const FIXTURE = `<html><body>
  <h2 class="elementor-heading-title">Postes offerts</h2>
  <div class="elementor-accordion">
    <div class="elementor-accordion-item">
      <a class="elementor-accordion-title" tabindex="0">Chargé(e) de projet/Estimation</a>
      <div class="elementor-tab-content">
        <h2>Description de tâche</h2>
        <div class="elementor-widget-text-editor">
          <ul><li>Effectuer la lecture de plans et analyser les documents de soumissions.</li></ul>
        </div>
      </div>
    </div>
    <div class="elementor-accordion-item">
      <a class="elementor-accordion-title">Charpentier (ère) – Menuisier (ère) en finition (Apprenti – Compagnon)</a>
      <div class="elementor-tab-content">
        <div class="elementor-widget-text-editor">
          <p>Nous sommes spécialisés dans l’installation de produits architecturaux.</p>
        </div>
      </div>
    </div>
  </div>
</body></html>`;

describe("parseChamplainMetal", () => {
  it("extrait une offre par volet d'accordéon", () => {
    const jobs = parseChamplainMetal(FIXTURE, BASE);
    assert.equal(jobs.length, 2);

    const charge = jobs[0]!;
    assert.equal(charge.title, "Chargé(e) de projet/Estimation");
    assert.equal(charge.company, "Champlain Métal (2001) inc.");
    assert.equal(charge.sourceId, "champlainmetal-com");
    assert.equal(charge.location, "Montréal");
    assert.equal(charge.url, `${BASE}#charge-e-de-projet-estimation`);
    assert.match(charge.description ?? "", /lecture de plans/);

    assert.equal(jobs[1]!.title, "Charpentier (ère) – Menuisier (ère) en finition (Apprenti – Compagnon)");
    assert.match(jobs[1]!.url, /#charpentier/);
  });

  it("dédoublonne les ancres identiques", () => {
    const dup = `${FIXTURE}${FIXTURE}`;
    assert.equal(parseChamplainMetal(dup, BASE).length, 2);
  });

  it("renvoie [] si aucune offre", () => {
    assert.deepEqual(parseChamplainMetal("<html><body></body></html>", BASE), []);
  });
});
