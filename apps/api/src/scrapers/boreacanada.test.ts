import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBoreA } from "./boreacanada.js";

const BASE_URL = "https://boreacanada.com/emplois/";

// Structure actuelle : refonte Bricks — chaque poste est une carte avec un lien
// `.work-offer-card__title` (href relatif vers la fiche du poste).
const CARD_FIXTURE = `
<!DOCTYPE html>
<html lang="fr">
<head><title>Emplois - BoreA Canada</title></head>
<body>
  <div class="brxe-container">
    <div class="brxe-div work-offer__intro-container">
      <h2 class="brxe-heading">Opportunités de carrière</h2>
    </div>
    <div class="brxe-block work-offer_grid">
      <div class="brxe-div work-offer-card" data-brx-loop-start="oeczwd">
        <div class="brxe-div work-offer-card__image-wrapper"><img alt="x" /></div>
        <a class="brxe-text-basic clickable-parent work-offer-card__title" href="adjointe-aux-ventes">Responsable de la logistique</a>
      </div>
      <div class="brxe-div work-offer-card">
        <a class="work-offer-card__title" href="journalieriere">Journalier(ière)</a>
      </div>
      <div class="brxe-div work-offer-card">
        <a class="work-offer-card__title" href="chauffeureuse-de-camion-c1">Chauffeur(euse) de camion C1</a>
      </div>
    </div>

    <h2>Pourquoi venir travailler avec nous ?</h2>
    <h3>Où se situe BoreA Canada ?</h3>
  </div>
</body>
</html>
`;

// Ancienne structure : les postes étaient de simples titres (h3) sous la section.
const HEADING_FIXTURE = `
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

describe("parseBoreA", () => {
  it("lit les cartes de poste (structure Bricks actuelle) avec leur lien", () => {
    const jobs = parseBoreA(CARD_FIXTURE, BASE_URL);
    assert.equal(jobs.length, 3);

    const logistique = jobs.find((j) => j.title === "Responsable de la logistique");
    assert.ok(logistique);
    assert.equal(logistique!.company, "BoreA Canada");
    assert.equal(logistique!.sourceId, "boreacanada-com");
    // href relatif résolu contre l'URL de la page carrières.
    assert.equal(logistique!.url, "https://boreacanada.com/emplois/adjointe-aux-ventes");

    // Titre d'un seul mot : accepté ici car la classe de carte est un signal fort.
    const journalier = jobs.find((j) => j.title === "Journalier(ière)");
    assert.ok(journalier);
    assert.equal(journalier!.url, "https://boreacanada.com/emplois/journalieriere");
  });

  it("repli : extrait les titres de poste sous la section carrière", () => {
    const jobs = parseBoreA(HEADING_FIXTURE, BASE_URL);
    assert.equal(jobs.length, 2);

    const logistique = jobs.find((j) => j.title === "Responsable de la logistique");
    assert.ok(logistique);
    assert.equal(logistique!.url, `${BASE_URL}#responsable-de-la-logistique`);

    const chauffeur = jobs.find((j) => j.title === "Chauffeur(euse) de camion C1");
    assert.ok(chauffeur);
    assert.equal(chauffeur!.url, `${BASE_URL}#chauffeur-euse-de-camion-c1`);
  });

  it("renvoie un tableau vide si aucune offre n'est présente", () => {
    assert.deepEqual(parseBoreA("<html><body></body></html>", BASE_URL), []);
  });
});
