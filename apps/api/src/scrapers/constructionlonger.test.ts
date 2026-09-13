import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseConstructionLonger } from "./constructionlonger.js";

const BASE = "https://hudl.ca/carriere";

const FIXTURE = `<html><body>
  <div id="career-posting">
    <div role="listitem" class="career_collection-item w-dyn-item">
      <a href="/carriere/estimateur-trice" class="career_infos-wrapper-link">
        <div class="infos_posting-title text-lg">Estimateur(trice)</div>
        <div class="career_infos-description text-md">
          <div>Sherbrooke</div>
          <div class="infos-description__spacer">•</div>
          <div>Temps plein</div>
        </div>
      </a>
    </div>
    <div role="listitem" class="career_collection-item w-dyn-item">
      <a href="/carriere/charpentieres-menuisieres-rive-sud" class="career_infos-wrapper-link">
        <div class="infos_posting-title text-lg">Charpentier(ère)s-menuisier(ères)</div>
        <div class="career_infos-description text-md">
          <div>Rive-Sud de Montréal</div>
          <div class="infos-description__spacer">•</div>
          <div>Temps plein</div>
        </div>
      </a>
    </div>
  </div>
  <a href="/carriere" class="nav-link">Carrière</a>
</body></html>`;

describe("parseConstructionLonger", () => {
  it("extrait les cartes Webflow HUDL", () => {
    const jobs = parseConstructionLonger(FIXTURE, BASE);
    assert.equal(jobs.length, 2);

    const est = jobs.find((j) => /estimateur/i.test(j.title));
    assert.ok(est);
    assert.equal(est.company, "Longer Système Intérieur inc.");
    assert.equal(est.sourceId, "constructionlonger-com");
    assert.equal(est.url, "https://hudl.ca/carriere/estimateur-trice");
    assert.equal(est.location, "Sherbrooke");
    assert.equal(est.employmentType, "temps-plein");

    const charp = jobs.find((j) => /charpentier/i.test(j.title));
    assert.ok(charp);
    assert.equal(charp.location, "Rive-Sud de Montréal");
    assert.ok(!jobs.some((j) => j.url === "https://hudl.ca/carriere"));
  });

  it("dédoublonne les mêmes URLs", () => {
    assert.equal(parseConstructionLonger(`${FIXTURE}${FIXTURE}`, BASE).length, 2);
  });

  it("renvoie [] si aucune offre", () => {
    assert.deepEqual(parseConstructionLonger("<html><body><h1>Carrière</h1></body></html>", BASE), []);
  });
});
