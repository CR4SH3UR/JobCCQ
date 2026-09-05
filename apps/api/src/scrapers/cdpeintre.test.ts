import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCdPeintre } from "./cdpeintre.js";

const BASE = "https://www.cdpeintre.com/carriere.php";

// Structure réelle : titre <h2> + bouton « Postulez en ligne » vers l'ancre du
// formulaire (la même pour tous les postes).
const FIXTURE = `
<!DOCTYPE html><html lang="fr"><body>
  <h2>Carrière</h2>
  <h2>Nous offrons...</h2>

  <div class="job">
    <h2>Estimateur-Estimatrice</h2>
    <a class="button blk-button__link" href="/carriere.php#row_SECTION_50JCDNN30M">Postulez en ligne</a>
  </div>
  <div class="job">
    <h2>Chargé(e) de projet</h2>
    <a class="button blk-button__link" href="/carriere.php#row_SECTION_50JCDNN30M">Postulez en ligne</a>
  </div>
  <div class="job">
    <h2>Peintre en bâtiment</h2>
    <a class="button blk-button__link" href="/carriere.php#row_SECTION_50JCDNN30M">Postulez en ligne</a>
  </div>

  <h2>Nos coordonnées</h2>
</body></html>
`;

describe("parseCdPeintre", () => {
  it("extrait un poste par bouton de candidature", () => {
    const jobs = parseCdPeintre(FIXTURE, BASE);
    assert.equal(jobs.length, 3);

    const est = jobs.find((j) => j.title === "Estimateur-Estimatrice");
    assert.ok(est);
    assert.equal(est!.company, "CD Peintre");
    assert.equal(est!.sourceId, "cdpeintre-com");
    assert.equal(est!.url, `${BASE}#estimateur-estimatrice`);

    assert.ok(jobs.find((j) => j.title === "Peintre en bâtiment"));
    // Les intitulés de section (« Nous offrons... », « Nos coordonnées ») sont ignorés.
    assert.ok(!jobs.some((j) => /coordonn|offrons/i.test(j.title)));
  });

  it("renvoie [] quand il n'y a aucun bouton de candidature", () => {
    assert.deepEqual(parseCdPeintre("<html><body><h2>Carrière</h2></body></html>", BASE), []);
  });
});
