import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detailsFromText, extractJobDetails, mergeJobDetails } from "./job-details.js";
import type { RawJob } from "@jobccq/shared";

const baseJob = (): RawJob => ({
  sourceId: "test",
  url: "https://exemple.test/emploi/",
  title: "Vendeur",
  company: "Exemple",
  location: "Joliette, QC",
  tags: [],
});

describe("extractJobDetails", () => {
  it("lit description, salaire, type et villes dans une fiche", () => {
    const html = `<html><body>
      <article>
        <p>Nous recherchons un vendeur pour desservir Joliette et Repentigny.</p>
        <p>Type d'emploi : Temps plein, Permanent</p>
        <p>Salaire : 50 000,00$ à 60 000,00$ par an</p>
        <p>Lieu du poste : Joliette</p>
      </article>
    </body></html>`;
    const d = extractJobDetails(html, "test", "https://exemple.test/emploi/");
    assert.match(d.description ?? "", /Nous recherchons un vendeur/);
    assert.equal(d.salaryMin, 50_000);
    assert.equal(d.salaryMax, 60_000);
    assert.equal(d.salaryPeriod, "annee");
    assert.equal(d.employmentType, "temps-plein");
    assert.match(d.location ?? "", /Joliette/i);
  });

  it("ignore une page d'accueil sans fiche", () => {
    const html = `<html><body><main>
      <p>En plus d'un service rapide, évaluation gratuite de vos besoins! Demande de soumission.</p>
    </main></body></html>`;
    const d = extractJobDetails(html, "test", "https://exemple.test/");
    assert.equal(d.description, undefined);
    assert.equal(d.salaryMin, undefined);
  });
});

describe("detailsFromText / mergeJobDetails", () => {
  it("garde une fourchette annuelle même si le texte parle d'heures", () => {
    const d = detailsFromText(
      "Poste temps plein, ±35 heures. Salaire : 50 000,00$ à 60 000,00$ par an. Horaire flexible.",
    );
    assert.equal(d.salaryMin, 50_000);
    assert.equal(d.salaryMax, 60_000);
    assert.equal(d.salaryPeriod, "annee");
    assert.equal(d.employmentType, "temps-plein");
  });

  it("extrait un taux horaire et ne remplace pas un lieu déjà précis", () => {
    const d = detailsFromText("Manœuvre CCQ. Salaire 28,50 $/heure. Lieu du poste : Déplacements fréquents");
    assert.equal(d.salaryMin, 28.5);
    assert.equal(d.salaryPeriod, "heure");
    assert.equal(d.location, undefined);

    const merged = mergeJobDetails(baseJob(), { ...d, location: "Joliette, Repentigny, QC" });
    assert.equal(merged.location, "Joliette, Repentigny, QC");
    assert.equal(merged.salaryMin, 28.5);
  });
});
