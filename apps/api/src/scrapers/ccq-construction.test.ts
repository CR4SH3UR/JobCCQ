import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCcqIndustryTitle, parseCcqConstruction } from "./ccq-construction.js";

const FIXTURE = `
<ul id="job-tile-list">
  <li class="job-tile" data-url="/job/Montreal-Programmeur-TI-QC/1/">
    <a class="jobTitle-link" href="/job/Montreal-Programmeur-TI-QC/1/">Programmeur(euse) analyste TI</a>
    <div id="job-1-desktop-section-city-value">Montréal</div>
  </li>
  <li class="job-tile" data-url="/job/Montreal-Chef-Qualification-QC/2/">
    <a class="jobTitle-link" href="/job/Montreal-Chef-Qualification-QC/2/">Chef(fe) de section, Qualification et référence</a>
    <div id="job-2-desktop-section-city-value">Montréal</div>
  </li>
  <li class="job-tile" data-url="/job/Gatineau-Charpentier-QC/3/">
    <a class="jobTitle-link" href="/job/Gatineau-Charpentier-QC/3/">Charpentier-menuisier</a>
    <div id="job-3-desktop-section-city-value">Gatineau</div>
  </li>
</ul>
`;

describe("parseCcqConstruction", () => {
  it("garde les postes industrie / métiers, ignore le TI interne", () => {
    const jobs = parseCcqConstruction(FIXTURE);
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0]!.title, "Chef(fe) de section, Qualification et référence");
    assert.equal(jobs[0]!.location, "Montréal");
    assert.match(jobs[0]!.url, /carriere\.ccq\.org\/job\//);
    assert.equal(jobs[1]!.title, "Charpentier-menuisier");
    assert.equal(jobs[1]!.company, "Commission de la construction du Québec");
  });

  it("reconnaît un titre métier CCQ", () => {
    assert.equal(isCcqIndustryTitle("Électricien de chantier"), true);
    assert.equal(isCcqIndustryTitle("Analyste SAP basis"), false);
  });
});
