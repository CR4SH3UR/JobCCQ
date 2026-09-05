import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBoreA } from "./boreacanada.js";

const FIXTURE = `
<!DOCTYPE html>
<html lang="fr">
<head><title>Emplois - BoreA Canada</title></head>
<body>
  <main>
    <h2>Travailler en pleine nature</h2>
    <p>BoreA Canada, un des plus grands producteurs...</p>

    <h2>Opportunités de carrière</h2>
    <h3>Responsable de la logistique</h3>
    <h3>Chauffeur(euse) de camion C1</h3>

    <h2>Pourquoi venir travailler avec nous ?</h2>
    <p>BoreA Canada est une entreprise écoresponsable...</p>

    <h3>Où se situe BoreA Canada ?</h3>
    <p>Nous sommes situés au cœur de la forêt boréale...</p>

    <h3>Proposez-vous des horaires flexibles ?</h3>
    <p>Oui. La conciliation travail-famille est importante...</p>
  </main>
</body>
</html>
`;

const BASE_URL = "https://boreacanada.com/emplois/";

describe("parseBoreA", () => {
  it("extrait les titres de poste sous la section carrière", () => {
    const jobs = parseBoreA(FIXTURE, BASE_URL);
    assert.equal(jobs.length, 2);

    const logistique = jobs.find((j) => j.title === "Responsable de la logistique");
    assert.ok(logistique);
    assert.equal(logistique!.company, "BoreA Canada");
    assert.equal(logistique!.sourceId, "boreacanada-com");
    assert.equal(logistique!.url, `${BASE_URL}#responsable-de-la-logistique`);

    const chauffeur = jobs.find((j) => j.title === "Chauffeur(euse) de camion C1");
    assert.ok(chauffeur);
    assert.equal(chauffeur!.url, `${BASE_URL}#chauffeur-euse-de-camion-c1`);
  });

  it("renvoie un tableau vide si la section carrière est absente", () => {
    assert.deepEqual(parseBoreA("<html><body></body></html>", BASE_URL), []);
  });
});
