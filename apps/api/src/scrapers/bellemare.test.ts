import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBellemare } from "./bellemare.js";

const BASE_URL = "https://bellemare.njoyn.com/cl3/xweb/Xweb.asp?page=joblisting&CLID=53428&lang=2";

const FIXTURE = `
<div id="accordion">
  <h2>J0826-0873 - Commis aux services mécaniques</h2>
  <div class="njnSection noborder">
    <div class="column">
      <div class="row"><span class="tombstonelabel">Catégorie</span><span class="tombstonevalue">Administration</span></div>
      <div class="row"><span class="tombstonelabel">Type de poste</span><span class="tombstonevalue">Permanent, temps plein</span></div>
      <div class="row"><span class="tombstonelabel">Ville</span><span class="tombstonevalue">Trois-Rivières</span></div>
    </div>
    <div class="column">
      <div class="row"><span class="tombstonelabel">Date d'affichage</span><span class="tombstonevalue">N/A</span></div>
      <div class="row"><span class="tombstonelabel">Date de fin d'affichage</span><span class="tombstonevalue">N/A</span></div>
    </div>
    <div class="row"><a title="Voir les détails du poste" href="xweb.asp?tbtoken=abc&clid=53428&Page=JobDetails&Jobid=J0826-0873&BRID=361641&lang=2">Détails du poste</a></div>
  </div>

  <h2>J0826-0827 - Opérateur(trice) de camion lance-pierre</h2>
  <div class="njnSection noborder">
    <div class="column">
      <div class="row"><span class="tombstonelabel">Catégorie</span><span class="tombstonevalue">Conduite de camion lourd</span></div>
      <div class="row"><span class="tombstonelabel">Type de poste</span><span class="tombstonevalue">Permanent, temps plein</span></div>
      <div class="row"><span class="tombstonelabel">Ville</span><span class="tombstonevalue">Louiseville</span></div>
    </div>
    <div class="row"><a href="xweb.asp?tbtoken=abc&clid=53428&Page=JobDetails&Jobid=J0826-0827&BRID=360805&lang=2">Détails du poste</a></div>
  </div>

  <h2>J0224-1788 - Candidature spontanée</h2>
  <div class="njnSection noborder">
    <div class="row"><a href="xweb.asp?tbtoken=abc&clid=53428&Page=JobDetails&Jobid=J0224-1788&BRID=123456&lang=2">Détails du poste</a></div>
  </div>
</div>
`;

describe("parseBellemare", () => {
  it("extrait les postes ouverts et ignore la candidature spontanée", () => {
    const jobs = parseBellemare(FIXTURE, BASE_URL);
    assert.equal(jobs.length, 2);

    const first = jobs[0]!;
    assert.equal(first.title, "Commis aux services mécaniques");
    assert.equal(first.location, "Trois-Rivières");
    assert.equal(first.employmentType, "temps-plein");
    assert.ok(first.tags?.includes("Administration"));
    assert.ok(first.url.includes("Jobid=J0826-0873"));
    assert.ok(first.url.startsWith("https://"));

    const second = jobs[1]!;
    assert.equal(second.title, "Opérateur(trice) de camion lance-pierre");
    assert.equal(second.location, "Louiseville");
    assert.ok(second.url.includes("Jobid=J0826-0827"));
  });

  it("renvoie un tableau vide si l'accordéon est absent", () => {
    assert.deepEqual(parseBellemare("<html></html>", BASE_URL), []);
  });
});
