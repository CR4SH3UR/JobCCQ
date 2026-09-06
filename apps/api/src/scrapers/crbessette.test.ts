import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCrBessette } from "./crbessette.js";

const BASE = "https://www.crbessette.com/carrieres/";

const FIXTURE = `<html><body>
  <a href="https://www.crbessette.com/carrieres/">Carrières</a>
  <h3>Postes disponibles</h3>
  <a href="https://www.crbessette.com/carrieres-frigoriste/">Frigoriste</a>
  <a href="https://www.crbessette.com/carrieres-frigoriste/">Carrières- Frigoriste</a>
  <a href="https://www.crbessette.com/carrieres-adjointe-administrative/">Adjointe administrative</a>
  <a href="/carriere-vendeur/">Vendeur</a>
  <a href="https://www.crbessette.com/carriere-vendeur/">Carrière – Vendeur</a>
</body></html>`;

describe("parseCrBessette", () => {
  it("extrait les fiches et préfère l'intitulé court", () => {
    const jobs = parseCrBessette(FIXTURE, BASE);
    assert.equal(jobs.length, 3);

    const frigo = jobs.find((j) => /frigoriste/i.test(j.title));
    assert.ok(frigo);
    assert.equal(frigo.title, "Frigoriste");
    assert.equal(frigo.company, "Climatisation R. Bessette inc.");
    assert.equal(frigo.sourceId, "crbessette-com");
    assert.equal(frigo.url, "https://www.crbessette.com/carrieres-frigoriste/");
    assert.equal(frigo.location, "Joliette, QC");

    assert.equal(
      jobs.find((j) => /adjointe/i.test(j.title))?.url,
      "https://www.crbessette.com/carrieres-adjointe-administrative/",
    );
    assert.equal(jobs.find((j) => /vendeur/i.test(j.title))?.url, "https://www.crbessette.com/carriere-vendeur/");
    assert.ok(!jobs.some((j) => /^carri/i.test(j.title)));
  });

  it("dédoublonne les mêmes URL", () => {
    assert.equal(parseCrBessette(`${FIXTURE}${FIXTURE}`, BASE).length, 3);
  });

  it("renvoie [] si aucune offre", () => {
    assert.deepEqual(
      parseCrBessette('<html><body><a href="/carrieres/">Carrières</a></body></html>', BASE),
      [],
    );
  });
});
