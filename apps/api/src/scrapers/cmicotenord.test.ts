import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCmiCoteNord } from "./cmicotenord.js";

const BASE = "https://www.cmicotenord.ca/emplois";

const FIXTURE = `<html><body>
  <h2>POSTES DISPONIBLES</h2>
  <a class="wixui-button" href="https://www.cmicotenord.ca/_files/ugd/shared.pdf"
     aria-label="CONDUCTEUR(TRICE) DE CAMION CLASSE 1">
    <span class="wixui-button__label">CONDUCTEUR(TRICE) DE CAMION CLASSE 1</span>
  </a>
  <a class="wixui-button" href="https://www.cmicotenord.ca/_files/ugd/shared.pdf"
     aria-label="MÉCANICIEN(NE) DE MACHINERIE LOURDE">
    <span class="wixui-button__label">MÉCANICIEN(NE) DE MACHINERIE LOURDE</span>
  </a>
  <a class="wixui-button"><span class="wixui-button__label">Envoyer</span></a>
  <a href="/services">Excavation</a>
</body></html>`;

describe("parseCmiCoteNord", () => {
  it("extrait les boutons de poste et ignore le CTA", () => {
    const jobs = parseCmiCoteNord(FIXTURE, BASE);
    assert.equal(jobs.length, 2);

    const cam = jobs.find((j) => /conducteur/i.test(j.title));
    assert.ok(cam);
    assert.equal(cam.title, "CONDUCTEUR(TRICE) DE CAMION CLASSE 1");
    assert.equal(cam.company, "CMI Côte Nord");
    assert.equal(cam.sourceId, "cmicotenord-ca");
    assert.equal(cam.location, "Baie-Comeau, QC");
    assert.equal(cam.url, `${BASE}#conducteur-trice-de-camion-classe-1`);

    assert.ok(jobs.find((j) => /m[eé]canicien/i.test(j.title)));
    assert.ok(!jobs.some((j) => /envoyer|excavation/i.test(j.title)));
  });

  it("dédoublonne le même titre malgré un PDF partagé", () => {
    assert.equal(parseCmiCoteNord(`${FIXTURE}${FIXTURE}`, BASE).length, 2);
  });

  it("renvoie [] si aucune offre", () => {
    assert.deepEqual(parseCmiCoteNord("<html><body><h2>EMPLOIS</h2></body></html>", BASE), []);
  });
});
