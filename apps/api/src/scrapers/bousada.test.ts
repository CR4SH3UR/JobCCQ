import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBousada } from "./bousada.js";

const FIXTURE = `
<div>
  <h5>Poste: Coordonnateur/Coordonnatrice Administratif(ve)</h5>
  <h5>Endroit: Siège social, Bromont</h5>
  <h5>Description du poste:</h5>
  <p>Chef de file dans le domaine du couvre-plancher...</p>
  <p>Sous la direction de la directrice...</p>
  <h5>Profil recherché:</h5>
  <p>Formation en administration.</p>

  <h5>Poste: Estimateur(trice)</h5>
  <h5>Endroit: Siège social, Bromont</h5>
  <h5>Description du poste:</h5>
  <p>Sous la supervision du directeur de l'estimation...</p>
</div>
`;

describe("parseBousada", () => {
  it("extrait titre, lieu et description de chaque section Poste", () => {
    const jobs = parseBousada(FIXTURE);
    assert.equal(jobs.length, 2);

    assert.equal(jobs[0]!.title, "Coordonnateur/Coordonnatrice Administratif(ve)");
    assert.equal(jobs[0]!.location, "Siège social, Bromont");
    assert.equal(jobs[0]!.url, "https://bousada.com/carriere/#coordonnateur-coordonnatrice-administratif-ve");
    assert.ok(jobs[0]!.description?.includes("Sous la direction"));

    assert.equal(jobs[1]!.title, "Estimateur(trice)");
    assert.equal(jobs[1]!.url, "https://bousada.com/carriere/#estimateur-trice");
  });

  it("renvoie un tableau vide s'il n'y a pas de section Poste", () => {
    assert.deepEqual(parseBousada("<html></html>"), []);
  });
});
