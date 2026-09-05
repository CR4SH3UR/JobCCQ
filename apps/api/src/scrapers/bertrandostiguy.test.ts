import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBertrandOstiguy } from "./bertrandostiguy.js";

const FIXTURE = `
<div id="lmc-jobs" class="container container-larger lmc-jobs">
  <h2>Opportunités d'emplois</h2>
  <div class="all-jobs">
    <nav class="jobs-list">
      <a href="#job-709"><span class="job-name">Manoeuvre en égout et aqueduc</span></a>
      <a href="#job-321"><span class="job-name">Mécanicien(ne) de camions lourds</span></a>
    </nav>
    <div class="jobs-content">
      <div class="lm-tabs-content completed" id="job-709">
        <div><span class="jobName">Manoeuvre en égout et aqueduc</span></div>
        <a class="copy_job_url" href="https://bertrandostiguy.ca/postuler-emploi/manoeuvre-en-egout-et-aqueduc/">Copier</a>
        <p><strong>POSTE</strong>:&nbsp;&nbsp;&nbsp;Permanent, temps plein</p>
      </div>
      <div class="lm-tabs-content hidden" id="job-321">
        <div><span class="jobName">Mécanicien(ne) de camions lourds</span></div>
        <a class="copy_job_url" href="/postuler-emploi/emploi-1/">Copier</a>
        <p><strong>POSTE</strong>:&nbsp;&nbsp;&nbsp;Permanent, temps plein</p>
      </div>
    </div>
  </div>
</div>
`;

describe("parseBertrandOstiguy", () => {
  it("extrait les titres, URLs et types d'emploi", () => {
    const jobs = parseBertrandOstiguy(FIXTURE, "https://bertrandostiguy.ca/emplois/");
    assert.equal(jobs.length, 2);

    const first = jobs[0]!;
    assert.equal(first.title, "Manoeuvre en égout et aqueduc");
    assert.equal(first.url, "https://bertrandostiguy.ca/postuler-emploi/manoeuvre-en-egout-et-aqueduc/");
    assert.equal(first.employmentType, "temps-plein");

    const second = jobs[1]!;
    assert.equal(second.title, "Mécanicien(ne) de camions lourds");
    assert.equal(second.url, "https://bertrandostiguy.ca/postuler-emploi/emploi-1/");
    assert.equal(second.employmentType, "temps-plein");
  });

  it("renvoie un tableau vide si la section d'emplois est absente", () => {
    assert.deepEqual(parseBertrandOstiguy("<html></html>", "https://bertrandostiguy.ca/emplois/"), []);
  });
});
