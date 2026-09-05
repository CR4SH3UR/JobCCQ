import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBetonFondationPlus } from "./betonfondationplus.js";

const FIXTURE = `
<div id="postes" class="col-lg-6">
  <h2 class="mt-0 mb-0">Postes disponibles</h2>
  <h3 class="my-4">Montréal et Rive-Sud</h3>

  <div class="card pb-3">
    <div id="p-0" class="poste">
      <div class="d-flex collapsed" role="button" data-toggle="collapse" data-target="#d-0">
        <div class="btn-open mr-3"></div>
        <p class="mb-0">Charpentier / Menuisier en coffrage</p>
      </div>
    </div>
    <div id="d-0" class="collapse" aria-labelledby="p-0" data-parent="#postes">
      <div class="card-body liste-carre">
        <p>La division de Montréal &amp; Rive-Sud est à la recherche de charpentiers.</p>
        <a href="javascript:void(0)" class="btn btn_primaire mt-4 btn_postulation"
           data-poste="Charpentier / Menuisier en coffrage" data-division="Montréal et Rive-Sud">Postuler</a>
      </div>
    </div>
  </div>

  <div class="card pb-3">
    <div id="p-1" class="poste">
      <div class="d-flex collapsed" role="button" data-toggle="collapse" data-target="#d-1">
        <div class="btn-open mr-3"></div>
        <p class="mb-0">Manoeuvre</p>
      </div>
    </div>
    <div id="d-1" class="collapse" aria-labelledby="p-1" data-parent="#postes">
      <div class="card-body liste-carre">
        <p>Recherche manoeuvre à Montréal.</p>
        <a href="javascript:void(0)" class="btn btn_primaire mt-4 btn_postulation"
           data-poste="Manoeuvre" data-division="Montréal et Rive-Sud">Postuler</a>
      </div>
    </div>
  </div>

  <div class="card pb-3">
    <div id="p-2" class="poste">
      <div class="d-flex collapsed" role="button" data-toggle="collapse" data-target="#d-2">
        <div class="btn-open mr-3"></div>
        <p class="mb-0">Manoeuvre</p>
      </div>
    </div>
    <div id="d-2" class="collapse" aria-labelledby="p-2" data-parent="#postes">
      <div class="card-body liste-carre">
        <p>Recherche manoeuvre en Estrie.</p>
        <a href="javascript:void(0)" class="btn btn_primaire mt-4 btn_postulation"
           data-poste="Manoeuvre" data-division="Estrie et Montérégie">Postuler</a>
      </div>
    </div>
  </div>
</div>
`;

describe("parseBetonFondationPlus", () => {
  it("extrait titre, division, description et URL stable", () => {
    const jobs = parseBetonFondationPlus(FIXTURE);
    assert.equal(jobs.length, 3);

    assert.equal(jobs[0]!.title, "Charpentier / Menuisier en coffrage");
    assert.equal(jobs[0]!.location, "Montréal et Rive-Sud");
    assert.ok(jobs[0]!.url.includes("#charpentier-menuisier-en-coffrage-montreal-et-rive-sud"));
    assert.ok(jobs[0]!.description?.includes("charpentiers"));
    assert.deepEqual(jobs[0]!.tags, ["Montréal et Rive-Sud"]);

    assert.equal(jobs[1]!.title, "Manoeuvre");
    assert.equal(jobs[1]!.location, "Montréal et Rive-Sud");
    assert.equal(jobs[2]!.title, "Manoeuvre");
    assert.equal(jobs[2]!.location, "Estrie et Montérégie");
    assert.notEqual(jobs[1]!.url, jobs[2]!.url);
  });

  it("renvoie un tableau vide si la section postes est absente", () => {
    assert.deepEqual(parseBetonFondationPlus("<html></html>"), []);
  });
});
