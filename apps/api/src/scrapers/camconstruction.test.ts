import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCamConstruction } from "./camconstruction.js";

const BASE = "https://camconstruction.ca/carriere/";

const FIXTURE = `<html><body>
  <section class="block block-jobs">
    <h2>Nos postes disponibles</h2>
    <div class="accordion-item">
      <button class="accordion-button">Charpentier (ière) -menuisier (ière)</button>
      <div class="accordion-body">
        <p>CAM est à la recherche de charpentier(ère)-menuisier(ère) avec les cartes CCQ.</p>
        <ul><li>Coffrage de dalle de béton</li></ul>
        <a class="apply-form" data-job-title="Charpentier (ière) -menuisier (ière)" href="#postuler">Postuler</a>
      </div>
    </div>
    <div class="accordion-item">
      <button class="accordion-button">Contremaître</button>
      <div class="accordion-body">
        <p>Chef d'orchestre sur le terrain.</p>
        <a class="apply-form" href="#postuler">Postuler</a>
      </div>
    </div>
  </section>
</body></html>`;

describe("parseCamConstruction", () => {
  it("extrait les accordéons de postes", () => {
    const jobs = parseCamConstruction(FIXTURE, BASE);
    assert.equal(jobs.length, 2);

    const charp = jobs.find((j) => /charpentier/i.test(j.title));
    assert.ok(charp);
    assert.equal(charp.company, "Construction Alain Morin inc.");
    assert.equal(charp.sourceId, "camconstruction-ca");
    assert.equal(charp.location, "Windsor, QC");
    assert.match(charp.url, /#charpentier/);
    assert.match(charp.description ?? "", /Coffrage de dalle/);

    assert.ok(jobs.find((j) => /contrema[iî]tre/i.test(j.title)));
  });

  it("dédoublonne les mêmes titres", () => {
    assert.equal(parseCamConstruction(`${FIXTURE}${FIXTURE}`, BASE).length, 2);
  });

  it("renvoie [] si aucune offre", () => {
    assert.deepEqual(parseCamConstruction("<html><body><h1>Carrière</h1></body></html>", BASE), []);
  });
});
