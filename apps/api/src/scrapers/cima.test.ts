import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCima } from "./cima.js";

const BASE = "https://www.cima.ca/carrieres/";

const FIXTURE = `<html><body>
  <div class="smartrecruitersJobList">
    <ul class="jobLine">
      <li class="tableTitle jobTitle">Titre du poste</li>
      <li class="tableTitle jobLocation">Localisation</li>
    </ul>
    <ul class="jobLine">
      <li class="srJobElement jobTitle">
        <a href="/carrieres/post-detail?post=744000147528549&amp;location=Montreal%2C+QC" class="jobDetailLink">Chargé-e de projet - Grand Montréal</a>
      </li>
      <li class="srJobElement jobLocation">Montreal, QC</li>
      <li class="srJobElement jobSector">Gestion de projet</li>
      <li class="srJobElement jobDate">2026-09-04</li>
    </ul>
    <ul class="jobLine">
      <li class="srJobElement jobTitle">
        <a href="/carrieres/post-detail?post=999" class="jobDetailLink">Project manager - Toronto</a>
      </li>
      <li class="srJobElement jobLocation">Toronto, ON</li>
      <li class="srJobElement jobDate">2026-09-01</li>
    </ul>
  </div>
  <a href="https://www.cima.ca/carrieres/?noq=0&pagination=14#jobs">14</a>
</body></html>`;

describe("parseCima", () => {
  it("extrait les postes Québec et ignore l'Ontario", () => {
    const jobs = parseCima(FIXTURE, BASE);
    assert.equal(jobs.length, 1);
    const job = jobs[0]!;
    assert.equal(job.title, "Chargé-e de projet - Grand Montréal");
    assert.equal(job.company, "Cima + Construction inc.");
    assert.equal(job.sourceId, "cima-ca");
    assert.equal(job.location, "Montreal, QC");
    assert.match(job.url, /post-detail\?post=744000147528549/);
    assert.equal(job.postedAt?.slice(0, 10), "2026-09-04");
    assert.deepEqual(job.tags, ["Gestion de projet"]);
    assert.ok(!jobs.some((j) => /Toronto/.test(j.title)));
  });

  it("dédoublonne les mêmes URL", () => {
    assert.equal(parseCima(`${FIXTURE}${FIXTURE}`, BASE).length, 1);
  });

  it("renvoie [] si aucune offre", () => {
    assert.deepEqual(parseCima("<html><body></body></html>", BASE), []);
  });
});
