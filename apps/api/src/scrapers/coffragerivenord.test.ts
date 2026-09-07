import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCoffrageRiveNord } from "./coffragerivenord.js";

const BASE = "https://www.coffragerivenord.com/carrieres";

const FIXTURE = `<html><body>
  <h2>Offres d'emplois</h2>
  <div class="flex-element group">
    <h3>Chauffeur recherché</h3>
    <ul>
      <li>Nous sommes présentement à la recherche d'un chauffeur pour notre camion flèche.</li>
      <li>Temps plein ou temps partiel</li>
    </ul>
  </div>
  <div class="flex-element group">
    <h3>Main-d'œuvre recherchée</h3>
    <ul>
      <li>Apprenti coffreur ou apprenti charpentier-menuisier</li>
    </ul>
  </div>
  <form class="dmform">
    <h3 class="dmform-title">Contact Us</h3>
  </form>
</body></html>`;

describe("parseCoffrageRiveNord", () => {
  it("extrait les postes H3 et ignore le formulaire", () => {
    const jobs = parseCoffrageRiveNord(FIXTURE, BASE);
    assert.equal(jobs.length, 2);

    const chauffeur = jobs.find((j) => /chauffeur/i.test(j.title));
    assert.ok(chauffeur);
    assert.equal(chauffeur.company, "Coffrage Rive-Nord et Fils inc.");
    assert.equal(chauffeur.sourceId, "coffragerivenord-com");
    assert.equal(chauffeur.url, `${BASE}#chauffeur-recherche`);
    assert.equal(chauffeur.location, "Saint-Gabriel-de-Brandon, QC");
    assert.match(chauffeur.description ?? "", /camion flèche/);

    assert.ok(jobs.find((j) => /main-d['’]œuvre/i.test(j.title)));
    assert.ok(!jobs.some((j) => /contact/i.test(j.title)));
    assert.ok(!jobs.some((j) => /offres/i.test(j.title)));
  });

  it("dédoublonne les mêmes titres", () => {
    assert.equal(parseCoffrageRiveNord(`${FIXTURE}${FIXTURE}`, BASE).length, 2);
  });

  it("renvoie [] si aucune offre", () => {
    assert.deepEqual(parseCoffrageRiveNord("<html><body><h1>Carrières</h1></body></html>", BASE), []);
  });
});
