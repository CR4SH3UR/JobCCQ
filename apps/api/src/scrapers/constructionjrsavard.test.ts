import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseJrsavard } from "./constructionjrsavard.js";

const FIXTURE = `
<section class="sect-container default-bg sect-job-offers">
  <div class="container">
    <div class="jobOffer-block">
      <div class="row align-items-center justify-content-between">
        <div class="col-lg pb-3 pb-lg-0">
          <h3>Contremaître de chantier – Génie civil</h3>
        </div>
      </div>
      <a href="https://constructionjrsavard.ca/carriere/contremaitre-de-chantier---genie-civil" class="link-overflow"></a>
    </div>
    <div class="jobOffer-block">
      <div class="row align-items-center justify-content-between">
        <div class="col-lg pb-3 pb-lg-0">
          <h3>Chef d'équipe de cours</h3>
        </div>
      </div>
      <a href="/carriere/chef-d-equipe-de-cours" class="link-overflow"></a>
    </div>
  </div>
</section>
`;

describe("parseJrsavard", () => {
  it("extrait les titres et URLs des blocs d'offres", () => {
    const jobs = parseJrsavard(FIXTURE);
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0]!.title, "Contremaître de chantier – Génie civil");
    assert.equal(jobs[0]!.url, "https://constructionjrsavard.ca/carriere/contremaitre-de-chantier---genie-civil");
    assert.equal(jobs[1]!.title, "Chef d'équipe de cours");
    assert.equal(jobs[1]!.url, "https://constructionjrsavard.ca/carriere/chef-d-equipe-de-cours");
  });

  it("renvoie un tableau vide s'il n'y a pas d'offres", () => {
    assert.deepEqual(parseJrsavard("<html></html>"), []);
  });
});
