import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTranselec } from "./transelec.js";

const BASE = "https://www.tciplus.ca/accueil-2/nous-rejoindre/nos-offres-demploi/";

const FIXTURE = `<html><body>
  <ul class="job-offers-list">
    <li class="item">
      <a href="https://jobs.vinci.com/en/job/-/-/1440/44370654400" class="job-offers" aria-label="Consulter l’offre d’emploi - Acheteur(euse) stratégique">
        <h3 class="function">Acheteur(euse) stratégique</h3>
        <span class="company">CANADA INFRA</span>
        <span class="location">600 rue Lucien-paiement, Laval</span>
        <span class="additional-infos__publication-time">Il y a 5 jours</span>
      </a>
    </li>
    <li class="item">
      <a href="https://jobs.vinci.com/en/job/-/-/1440/44074654272" class="job-offers">
        <h3 class="function">Assistant responsable d’affaires</h3>
        <span class="location">Laval, Qc, Canada</span>
      </a>
    </li>
    <li class="item">
      <a href="https://jobs.vinci.com/en/job/-/-/1440/42853863104" class="job-offers">
        <h3 class="function">Responsable d’affaires</h3>
        <span class="location">Montréal, Qc, Canada</span>
      </a>
    </li>
  </ul>
  <a class="intern-link" href="https://jobs.vinci.com/fr/recherche-d%27offres">Retrouvez toutes nos offres d'emploi</a>
</body></html>`;

describe("parseTranselec", () => {
  it("extrait les cartes TCI+ et ignore le lien « toutes les offres »", () => {
    const jobs = parseTranselec(FIXTURE, BASE);
    assert.equal(jobs.length, 3);

    const achat = jobs.find((j) => /acheteur/i.test(j.title));
    assert.ok(achat);
    assert.equal(achat.company, "Transelec/Common inc.");
    assert.equal(achat.sourceId, "transelec-com");
    assert.equal(achat.url, "https://jobs.vinci.com/en/job/-/-/1440/44370654400");
    assert.equal(achat.location, "600 rue Lucien-paiement, Laval");
    assert.ok(achat.postedAt);

    const adjoint = jobs.find((j) => /assistant/i.test(j.title));
    assert.equal(adjoint?.location, "Laval, Qc, Canada");

    assert.ok(!jobs.some((j) => /recherche-d/i.test(j.url)));
  });
});
