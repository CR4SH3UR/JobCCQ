import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBouty } from "./bouty.js";

const CAREERS_URL = "https://www.bouty.com/fr/a-propos/carrieres/";

const FIXTURE = `
<!DOCTYPE html>
<html lang="fr">
<head><title>Carrières | Bouty</title></head>
<body>
  <section class="block_image_text__wrapper block--1">
    <div class="block_image_text__description">
      <div class="wysiwyg">
        <h3>Repr&eacute;sentant des ventes et des sp&eacute;cifications (A&amp;D)</h3>
        <p><span class="h6">Le candidat sera responsable de la promotion de la vaste gamme des produits.</span></p>
        <p><span class="h5"><strong><a href="https://www.bouty.com/app/uploads/2023/03/Bouty_Description-de-poste_Representant-des-ventes.pdf" target="_blank" rel="noopener">T&eacute;l&eacute;charger la description du poste</a></strong></span></p>
        <p><strong><a href="mailto:rh@bouty.com">Postulez ici</a></strong></p>
      </div>
    </div>
  </section>

  <section class="block_image_text__wrapper block--2">
    <div class="block_image_text__description">
      <div class="wysiwyg">
        <h3>Technicien R&amp;D</h3>
        <h4>CONCEPTEUR | DESSINATEUR</h4>
        <p><span class="h6">Nous sommes &agrave; la recherche d&rsquo;une personne comp&eacute;tente pour pourvoir un poste de technicien dessinateur.</span></p>
        <p><strong><a href="mailto:rh@bouty.com">Postulez ici</a></strong></p>
      </div>
    </div>
  </section>
</body>
</html>
`;

describe("parseBouty", () => {
  it("extrait les postes avec le lien PDF ou un fragment de repli", () => {
    const jobs = parseBouty(FIXTURE, CAREERS_URL);
    assert.equal(jobs.length, 2);

    const representant = jobs.find((j) =>
      j.title.startsWith("Représentant des ventes"),
    );
    assert.ok(representant);
    assert.equal(representant!.company, "Bouty inc.");
    assert.equal(
      representant!.url,
      "https://www.bouty.com/app/uploads/2023/03/Bouty_Description-de-poste_Representant-des-ventes.pdf",
    );
    assert.ok(
      representant!.description?.includes(
        "responsable de la promotion de la vaste gamme",
      ),
    );

    const technicien = jobs.find((j) => j.title.startsWith("Technicien R&D"));
    assert.ok(technicien);
    assert.equal(
      technicien!.title,
      "Technicien R&D — CONCEPTEUR | DESSINATEUR",
    );
    assert.equal(
      technicien!.url,
      `${CAREERS_URL}#technicien-r-d-concepteur-dessinateur`,
    );
  });

  it("renvoie un tableau vide si aucune offre n'est présente", () => {
    assert.deepEqual(parseBouty("<html><body></body></html>", CAREERS_URL), []);
  });
});
