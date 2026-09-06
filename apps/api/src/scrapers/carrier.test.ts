import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCarrier } from "./carrier.js";

const BASE = "https://jobs.carrier.com/fr/lieu/canada-jobs/29289/6251999/2";

/** Extrait TalentBrew : 2 postes QC + 1 hors Québec (ON). */
const FIXTURE = `<html><body>
  <section id="search-results" data-total-pages="2" data-total-job-results="16">
    <ul>
      <li>
        <a href="/fr/emploi/saint-laurent/technicien-ne-frigoriste/29289/97797119536" data-job-id="97797119536">
          <h2>Technicien(ne) Frigoriste</h2>
          <p class="job-location">LOC13059 625-629 Mccaffrey Street, Ville-Saint Laurent, QC, H4T 1N3 ,Canada</p>
        </a>
      </li>
      <li>
        <a href="/fr/emploi/quebec/apprenti-frigoriste-3eme-annee/29289/93763492720" data-job-id="93763492720">
          <h2>Apprenti Frigoriste 3ème année (CAA) -Ville de Québec</h2>
          <p class="job-location">LOC13095: Offsite Remote Location - Quebec City, Quebec, Canada</p>
        </a>
      </li>
      <li>
        <a href="/fr/emploi/mississauga/controls-specialist/29289/99674408704" data-job-id="99674408704">
          <h2>Controls Specialist</h2>
          <p class="job-location">LOC13058 6060 Burnside Court, Mississauga, ON , L5T 2T5 ,Canada</p>
        </a>
      </li>
    </ul>
  </section>
</body></html>`;

describe("parseCarrier", () => {
  it("extrait les postes Québec et ignore l'Ontario", () => {
    const jobs = parseCarrier(FIXTURE, BASE);
    assert.equal(jobs.length, 2);

    const frigo = jobs.find((j) => j.title === "Technicien(ne) Frigoriste");
    assert.ok(frigo);
    assert.equal(frigo.company, "Carrier Canada Corporation");
    assert.equal(frigo.sourceId, "carrier-com");
    assert.equal(
      frigo.url,
      "https://jobs.carrier.com/fr/emploi/saint-laurent/technicien-ne-frigoriste/29289/97797119536",
    );
    assert.match(frigo.location ?? "", /Saint Laurent, QC/);
    assert.ok(!/^LOC/i.test(frigo.location ?? ""));

    const apprenti = jobs.find((j) => /Apprenti Frigoriste/.test(j.title));
    assert.ok(apprenti);
    assert.match(apprenti.location ?? "", /Quebec City/i);

    assert.ok(!jobs.some((j) => j.title === "Controls Specialist"));
  });

  it("dédoublonne les mêmes URL", () => {
    const dup = `${FIXTURE}${FIXTURE}`;
    assert.equal(parseCarrier(dup, BASE).length, 2);
  });

  it("renvoie [] si aucune offre", () => {
    assert.deepEqual(parseCarrier("<html><body></body></html>", BASE), []);
  });
});
