import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCasParCas } from "./casparcas.js";

const BASE = "https://www.casparcas.ca/carriere/";

// Structure réelle (Elementor) : chaque intitulé est un <h1>. Les postes sont
// entre « Postes disponibles » et la section de clôture « Faites le premier
// pas… » ; certains ont une fiche `/emploi-…/`, d'autres non.
const FIXTURE = `
<!DOCTYPE html><html lang="fr"><body>
  <section><h1>CARRIÈRE</h1></section>
  <section><h1>Nous offrons</h1></section>
  <section>
    <h1>Postes disponibles</h1>
    <div class="elementor-widget-wrap">
      <h1>Responsable d'atelier (ébénisterie)</h1>
      <div class="elementor-widget-wrap"><a href="https://www.casparcas.ca/emploi-superviseur_atelier_ebenisterie/">En savoir plus</a></div>
    </div>
    <div class="elementor-widget-wrap">
      <h1>Charpentier-menuisier</h1>
    </div>
    <div class="elementor-widget-wrap"><h1>Candidatures spontanées</h1></div>
    <div class="elementor-widget-wrap">
      <h1>Menuisier en finition intérieure</h1>
      <div class="elementor-widget-wrap"><a href="https://www.casparcas.ca/emploi-menuisier-finition-interieure/">En savoir plus</a></div>
    </div>
  </section>
  <section><h1>Faites le premier pas — on s'occupe du reste</h1></section>
</body></html>
`;

describe("parseCasParCas", () => {
  it("extrait les postes de la section, avec ou sans fiche dédiée", () => {
    const jobs = parseCasParCas(FIXTURE, BASE);
    assert.equal(jobs.length, 3);

    const resp = jobs.find((j) => j.title === "Responsable d'atelier (ébénisterie)");
    assert.ok(resp);
    assert.equal(resp!.company, "Cas par Cas");
    assert.equal(resp!.sourceId, "casparcas-ca");
    assert.equal(resp!.url, "https://www.casparcas.ca/emploi-superviseur_atelier_ebenisterie/");

    // Poste sans fiche dédiée → ancre slugifiée sur la page carrière.
    const charp = jobs.find((j) => j.title === "Charpentier-menuisier");
    assert.ok(charp);
    assert.equal(charp!.url, `${BASE}#charpentier-menuisier`);

    // Les candidatures spontanées et les sections hors zone sont ignorées.
    assert.ok(!jobs.some((j) => /spontan|carri[eè]re|premier pas|offrons/i.test(j.title)));
  });

  it("renvoie [] si la section « Postes disponibles » est absente", () => {
    assert.deepEqual(parseCasParCas("<html><body><h1>Accueil</h1></body></html>", BASE), []);
  });
});
