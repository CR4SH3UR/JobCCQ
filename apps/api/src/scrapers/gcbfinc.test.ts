import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGcbfinc } from "./gcbfinc.js";

const FIXTURE = `
<!DOCTYPE html>
<html lang="fr">
<head><title>Carrière - La Famille CBF</title></head>
<body>
  <div class="results_col">
    <div class="offre_title_btn">
      <a class="link_offre" href="https://gcbfinc.com/offre-emploi/soudeur-soudure-cbf/">
        <p class="title_offre">Soudeur &#8211; Soudure CBF</p>
        <p class="btn_filter_offres">En savoir plus</p>
      </a>
    </div>
    <div class="offre_title_btn">
      <a class="link_offre" href="/offre-emploi/foreur-dth/">
        <p class="title_offre">Foreur DTH</p>
        <p class="btn_filter_offres">En savoir plus</p>
      </a>
    </div>
  </div>
</body>
</html>
`;

describe("parseGcbfinc", () => {
  it("extrait les postes depuis les blocs offre_title_btn", () => {
    const jobs = parseGcbfinc(FIXTURE);
    assert.equal(jobs.length, 2);

    const soudeur = jobs.find((j) => j.title === "Soudeur – Soudure CBF");
    assert.ok(soudeur);
    assert.equal(soudeur!.company, "La Famille CBF");
    assert.equal(
      soudeur!.url,
      "https://gcbfinc.com/offre-emploi/soudeur-soudure-cbf/",
    );

    const foreur = jobs.find((j) => j.title === "Foreur DTH");
    assert.ok(foreur);
    assert.equal(foreur!.url, "https://gcbfinc.com/offre-emploi/foreur-dth/");
  });

  it("renvoie un tableau vide si aucune offre n'est présente", () => {
    assert.deepEqual(parseGcbfinc("<html><body></body></html>"), []);
  });
});
