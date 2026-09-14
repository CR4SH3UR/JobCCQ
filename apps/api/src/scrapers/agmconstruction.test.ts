import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAgmConstruction } from "./agmconstruction.js";

const BASE = "https://www.agmconstruction.ca/careers";

const FIXTURE = `<html><body>
  <section id="postes">
    <div role="list" class="job-list w-dyn-items">
      <div role="listitem" class="job-list-item w-dyn-item">
        <div class="uppercase-text">Actif</div>
        <a href="/carriere/contremaitre-en-construction-commercial" class="job-link">Contremaître en construction commercial</a>
        <div class="job-basis"><div>Rivière-du-Loup</div><div>, </div><div>Temps plein</div></div>
      </div>
      <div role="listitem" class="job-list-item w-dyn-item">
        <a href="/carriere/charpentier-menuisier" class="job-link">Charpentier-menuisier</a>
        <div class="job-basis"><div>Rivière-du-loup</div><div>, </div><div>Temps plein</div></div>
      </div>
    </div>
  </section>
  <a href="/careers" class="nav-link">Carrières</a>
</body></html>`;

describe("parseAgmConstruction", () => {
  it("extrait les cartes Webflow AGM", () => {
    const jobs = parseAgmConstruction(FIXTURE, BASE);
    assert.equal(jobs.length, 2);

    const contre = jobs.find((j) => /contrema[iî]tre/i.test(j.title));
    assert.ok(contre);
    assert.equal(contre.company, "A.G.M. Construction Inc.");
    assert.equal(contre.sourceId, "agmconstruction-ca");
    assert.equal(contre.url, "https://www.agmconstruction.ca/carriere/contremaitre-en-construction-commercial");
    assert.equal(contre.location, "Rivière-du-Loup");
    assert.equal(contre.employmentType, "temps-plein");

    const charp = jobs.find((j) => /charpentier/i.test(j.title));
    assert.ok(charp);
    assert.equal(charp.location, "Rivière-du-loup");
    assert.ok(!jobs.some((j) => j.url === "https://www.agmconstruction.ca/careers"));
  });
});
