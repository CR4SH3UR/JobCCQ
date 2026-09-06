import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseChnPaysagiste } from "./chn-paysagiste.js";

const BASE = "https://www.chn-paysagiste.com/carriere";

const FIXTURE = `<html><body>
  <section id="carriere-postes">
    <p>Postes disponibles</p>
    <div class="col s12 m6">
      <h4 class="font-bold">Opérateur de <br>pelle mécanique</h4>
      <a href="/emplois/operateur-pelle">En savoir plus sur le poste</a>
    </div>
    <div class="col s12 m6">
      <h4>Menuisier/<br>Menuisière</h4>
      <a href="/emplois/menuisier">En savoir plus sur le poste</a>
    </div>
    <a href="/carriere#carriere-postes">Joignez-vous à l'équipe</a>
  </section>
</body></html>`;

describe("parseChnPaysagiste", () => {
  it("extrait le titre de la carte, pas le libellé du lien", () => {
    const jobs = parseChnPaysagiste(FIXTURE, BASE);
    assert.equal(jobs.length, 2);

    const op = jobs.find((j) => /Opérateur/.test(j.title));
    assert.ok(op);
    assert.equal(op.title, "Opérateur de pelle mécanique");
    assert.equal(op.company, "CHN inc.");
    assert.equal(op.sourceId, "chn-paysagiste-com");
    assert.equal(op.url, "https://www.chn-paysagiste.com/emplois/operateur-pelle");
    assert.equal(op.location, "Saint-Jérôme, QC");

    assert.equal(jobs.find((j) => /Menuisier/.test(j.title))?.url, "https://www.chn-paysagiste.com/emplois/menuisier");
    assert.ok(!jobs.some((j) => /savoir plus/i.test(j.title)));
  });

  it("dédoublonne les mêmes URL", () => {
    assert.equal(parseChnPaysagiste(`${FIXTURE}${FIXTURE}`, BASE).length, 2);
  });

  it("renvoie [] si aucune offre", () => {
    assert.deepEqual(parseChnPaysagiste("<html><body></body></html>", BASE), []);
  });
});
