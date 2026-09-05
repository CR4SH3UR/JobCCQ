import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseQmb } from "./qmb.js";

const FIXTURE = `
<section>
  <a href="https://qmb.ca/carrieres/operateur-circulation-routiere/">
    <span>Opérateur(trice), circulation routière</span>
    <span class="location">Laval, QC</span>
    <p class="btn-default" role="link">Postuler</p>
  </a>
  <a href="https://qmb.ca/carrieres/contremaitre/">
    <span>Contremaître</span>
    <span class="location">Québec, QC</span>
  </a>
  <a href="https://qmb.ca/carrieres/gallery/careers-jobs_01.jpg"></a>
  <a href="https://qmb.ca/carrieres/">Carrières</a>
  <a href="https://qmb.ca/en/carrieres/">EN</a>
</section>
`;

describe("parseQmb", () => {
  it("extrait les cartes (titre + lieu), sans galerie ni navigation", () => {
    const jobs = parseQmb(FIXTURE);
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0]!.title, "Opérateur(trice), circulation routière");
    assert.equal(jobs[0]!.location, "Laval, QC");
    assert.match(jobs[0]!.url, /operateur-circulation-routiere/);
    assert.equal(jobs[1]!.title, "Contremaître");
    assert.ok(!jobs.some((j) => /gallery|\.jpg/i.test(j.url)));
    assert.ok(!jobs.some((j) => j.title === "Carrières"));
  });
});
