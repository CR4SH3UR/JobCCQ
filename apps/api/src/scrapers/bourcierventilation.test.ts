import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBourcierVentilation } from "./bourcierventilation.js";

const FIXTURE = `
<!DOCTYPE html>
<html lang="fr">
<head><title>Carrière – BourcierVentilation</title></head>
<body>
  <main class="page">
    <section class="page-section">
      <h2>Opportunités Actuelles chez Bourcier Ventilation</h2>
      <p>Nous recrutons des talents pour les postes suivants :</p>

      <div class="job-listing">
        <h3>Représentant des Ventes</h3>
        <p>Développez des relations clients, identifiez leurs besoins et dépassez vos objectifs de vente.</p>
        <a href="#contact-form">Postuler ici</a>
      </div>

      <div class="job-listing">
        <h3>Technicien en CVAC</h3>
        <p>Installez, entretenez et réparez des systèmes de chauffage, ventilation et climatisation.</p>
        <a href="mailto:info@bourcierventilation.com">Postuler ici</a>
      </div>
    </section>
  </main>
</body>
</html>
`;

describe("parseBourcierVentilation", () => {
  it("extrait les postes depuis les liens Postuler ici", () => {
    const jobs = parseBourcierVentilation(FIXTURE);
    assert.equal(jobs.length, 2);

    const vendeur = jobs.find((j) => j.title === "Représentant des Ventes");
    assert.ok(vendeur);
    assert.equal(vendeur!.company, "Bourcier Ventilation inc.");
    assert.equal(
      vendeur!.url,
      "https://shop.bourcierventilation.com/pages/carriere#representant-des-ventes",
    );
    assert.equal(
      vendeur!.description,
      "Développez des relations clients, identifiez leurs besoins et dépassez vos objectifs de vente.",
    );

    const technicien = jobs.find((j) => j.title === "Technicien en CVAC");
    assert.ok(technicien);
    assert.equal(
      technicien!.url,
      "https://shop.bourcierventilation.com/pages/carriere#technicien-en-cvac",
    );
  });

  it("renvoie un tableau vide s'il n'y a aucun lien Postuler ici", () => {
    assert.deepEqual(
      parseBourcierVentilation("<html><body><h3>Représentant</h3></body></html>"),
      [],
    );
  });
});
