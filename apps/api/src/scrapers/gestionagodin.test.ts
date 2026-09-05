import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAgodin } from "./gestionagodin.js";

const FIXTURE = `
<section class="elementor">
  <ul>
    <li><strong>Gérant(e) de chantier</strong> — supervise les travaux</li>
    <li><strong>Technicien(e) en mécanique du bâtiment</strong></li>
    <li><strong>Certificat de compétence COMPAGNON de la CCQ</strong></li>
    <li><strong>Certificat de compétence APPRENTI de la CCQ</strong></li>
  </ul>
  <div class="phone"><strong>SANS FRAIS</strong></div>
</section>
`;

describe("parseAgodin", () => {
  it("lit les postes en gras (li>strong) et écarte exigences + bruit", () => {
    const jobs = parseAgodin(FIXTURE);
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0]!.title, "Gérant(e) de chantier");
    assert.equal(jobs[1]!.title, "Technicien(e) en mécanique du bâtiment");
    assert.equal(jobs[0]!.location, "Beloeil, QC");
    assert.ok(!jobs.some((j) => /certificat|sans frais/i.test(j.title)));
    assert.match(jobs[0]!.url, /#gerant/);
  });
});
