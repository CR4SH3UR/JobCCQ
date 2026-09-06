import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseChauffageMc } from "./chauffagemc.js";

const BASE = "https://www.chauffagemc.ca/carriere";

/** Extrait de la page `/carriere` : 2 volets `.toggle`. */
const FIXTURE = `<html><body>
  <h1 class="page-title">Offre d'emplois</h1>
  <div class="toggle">
    <h2 class="toggle__title">Viens faire carrière comme plombier chez Chauffage M.C</h2>
    <div class="toggle__content">
      <h3>Recherche :</h3>
      <ul class="checklist">
        <li>Apprenti première année minimum</li>
        <li>Carte CCQ valide</li>
      </ul>
      <p>Pour postuler, envoyez-nous votre C.V. par courriel à <a href="mailto:info@chauffagemc.com">info@chauffagemc.com</a></p>
    </div>
  </div>
  <div class="toggle">
    <h2 class="toggle__title">Technicien / Installateur d'appareils de chauffage mazout, électricité, gaz naturel</h2>
    <div class="toggle__content">
      <ul class="checklist"><li>Formation plomberie - Chauffage</li></ul>
    </div>
  </div>
</body></html>`;

describe("parseChauffageMc", () => {
  it("extrait une offre par volet toggle", () => {
    const jobs = parseChauffageMc(FIXTURE, BASE);
    assert.equal(jobs.length, 2);

    const plombier = jobs[0]!;
    assert.equal(plombier.title, "Viens faire carrière comme plombier chez Chauffage M.C");
    assert.equal(plombier.company, "Chauffage M.C. (2007) inc.");
    assert.equal(plombier.sourceId, "chauffagemc-com");
    assert.equal(plombier.location, "Hérouxville, QC");
    assert.equal(plombier.url, `${BASE}#viens-faire-carriere-comme-plombier-chez-chauffage-m-c`);
    assert.match(plombier.description ?? "", /Carte CCQ valide/);

    assert.match(jobs[1]!.title, /Technicien \/ Installateur/);
    assert.match(jobs[1]!.url, /#technicien-installateur/);
  });

  it("dédoublonne les ancres identiques", () => {
    const dup = `${FIXTURE}${FIXTURE}`;
    assert.equal(parseChauffageMc(dup, BASE).length, 2);
  });

  it("renvoie [] si aucune offre", () => {
    assert.deepEqual(parseChauffageMc("<html><body></body></html>", BASE), []);
  });
});
