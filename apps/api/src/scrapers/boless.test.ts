import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBoless } from "./boless.js";

const FIXTURE = `
<!DOCTYPE html>
<html lang="fr">
<head><title>Carrière Archive - Boless Inc</title></head>
<body>
  <div class="archive-bottom grid_section">
    <article id="post-1358" class="post-1358 carriere type-carriere status-publish has-post-thumbnail hentry">
      <div class="post_content_holder">
        <div class="post_image" style="background-image: url(...);"></div>
        <div class="post_text">
          <div class="post_text_inner">
            <h4>Estimateur en Construction</h4>
            <p>Joignez l’équipe Boless : Nous recrutons un Estimateur en Construction !</p>
            <p class="qbutton small">Voir l'offre</p>
          </div>
        </div>
        <a href="https://www.boless.com/carriere/estimateur-en-construction/" title="Estimateur en Construction"></a>
      </div>
    </article>
    <article id="post-1338" class="post-1338 carriere type-carriere status-publish has-post-thumbnail hentry">
      <div class="post_content_holder">
        <div class="post_image" style="background-image: url(...);"></div>
        <div class="post_text">
          <div class="post_text_inner">
            <h4>Chargé de projet  en construction</h4>
            <p>Joignez l’équipe Boless : Nous recrutons un Chargé de projet  en construction !</p>
            <p class="qbutton small">Voir l'offre</p>
          </div>
        </div>
        <a href="https://www.boless.com/carriere/charge-de-projet-en-construction/" title="Chargé de projet  en construction"></a>
      </div>
    </article>
  </div>
</body>
</html>
`;

describe("parseBoless", () => {
  it("extrait les postes depuis les articles type-carriere", () => {
    const jobs = parseBoless(FIXTURE);
    assert.equal(jobs.length, 2);

    const estimateur = jobs.find((j) => j.title === "Estimateur en Construction");
    assert.ok(estimateur);
    assert.equal(estimateur!.company, "Boless inc.");
    assert.equal(
      estimateur!.url,
      "https://www.boless.com/carriere/estimateur-en-construction/",
    );
    assert.equal(
      estimateur!.description,
      "Joignez l’équipe Boless : Nous recrutons un Estimateur en Construction !",
    );

    const charge = jobs.find((j) => j.title === "Chargé de projet en construction");
    assert.ok(charge);
    assert.equal(
      charge!.url,
      "https://www.boless.com/carriere/charge-de-projet-en-construction/",
    );
  });

  it("renvoie un tableau vide si aucune offre n'est présente", () => {
    assert.deepEqual(parseBoless("<html><body></body></html>"), []);
  });
});
