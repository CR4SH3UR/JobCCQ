import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseClaveauEtFils } from "./claveauetfils.js";

const BASE = "https://claveauetfils.ca/carrieres/";

const FIXTURE = `<html><body>
  <form id="form_carrieres" class="frm-show-form">
    <label for="field_knyqj">Poste désiré</label>
    <select name="item_meta[12]" id="field_knyqj">
      <option value="">Poste désiré</option>
      <option value="Camionneur">Camionneur</option>
      <option value="Manœuvre CCQ">Manœuvre CCQ</option>
      <option value="Opérateur de pelles mécaniques CCQ">Opérateur de pelles mécaniques CCQ</option>
    </select>
  </form>
</body></html>`;

describe("parseClaveauEtFils", () => {
  it("extrait les métiers du menu Poste désiré", () => {
    const jobs = parseClaveauEtFils(FIXTURE, BASE);
    assert.equal(jobs.length, 3);

    const cam = jobs.find((j) => j.title === "Camionneur");
    assert.ok(cam);
    assert.equal(cam.company, "Claveau Et Fils inc.");
    assert.equal(cam.sourceId, "claveauetfils-ca");
    assert.equal(cam.url, `${BASE}#camionneur`);
    assert.equal(cam.location, "Jonquière, QC");

    assert.ok(jobs.find((j) => j.title === "Manœuvre CCQ"));
    assert.ok(jobs.find((j) => /pelles mécaniques/i.test(j.title)));
    assert.ok(!jobs.some((j) => /poste d[ée]sir/i.test(j.title)));
  });

  it("dédoublonne les mêmes options", () => {
    assert.equal(parseClaveauEtFils(`${FIXTURE}${FIXTURE}`, BASE).length, 3);
  });

  it("renvoie [] si aucune offre", () => {
    assert.deepEqual(parseClaveauEtFils("<html><body><h1>Carrières</h1></body></html>", BASE), []);
  });
});
