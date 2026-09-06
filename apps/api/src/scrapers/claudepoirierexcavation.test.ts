import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseClaudePoirierExcavation } from "./claudepoirierexcavation.js";

const BASE = "https://www.claudepoirierexcavation.com/carrières";

const FIXTURE = `<html><body>
  <h5>POSTE(S) DISPONIBLE(S)</h5>
  <a data-anchor="dataItem-1" href="https://www.claudepoirierexcavation.com/carrières#anchor1"
     aria-label="Chauffeur ou chauffeuse Classe 1">
    <span>Chauffeur ou chauffeuse Classe 1</span>
  </a>
  <a data-anchor="dataItem-2" href="https://www.claudepoirierexcavation.com/carrières#anchor2"
     aria-label="Opérateur de pelle">
    <span>Opérateur de pelle</span>
  </a>
  <h5>CANDIDATURE SPONTANÉE</h5>
  <p>Veuillez également envoyer votre CV à info@claudepoirierexcavation.com</p>
  <h5>CHAUFFEUR OU CHAUFFEUSE - CLASSE 1</h5>
  <p>PRINCIPALES RESPONSABILITÉS : Divers transports pour les chantiers</p>
  <h5>OPÉRATEUR DE PELLE</h5>
  <h5>À PROPOS</h5>
  <h5>NOS SERVICES</h5>
</body></html>`;

describe("parseClaudePoirierExcavation", () => {
  it("extrait les postes, préfère le titre H5 et ignore les sections", () => {
    const jobs = parseClaudePoirierExcavation(FIXTURE, BASE);
    assert.equal(jobs.length, 2);

    const chauffeur = jobs.find((j) => /chauffeur/i.test(j.title));
    assert.ok(chauffeur);
    assert.equal(chauffeur.title, "CHAUFFEUR OU CHAUFFEUSE - CLASSE 1");
    assert.equal(chauffeur.company, "Claude Poirier Excavation inc.");
    assert.equal(chauffeur.sourceId, "claudepoirierexcavation-com");
    assert.equal(chauffeur.url, `${BASE}#anchor1`);
    assert.equal(chauffeur.location, "Saint-Jean-Baptiste, QC");

    const op = jobs.find((j) => /op[eé]rateur/i.test(j.title));
    assert.ok(op);
    assert.equal(op.url, `${BASE}#anchor2`);

    assert.ok(!jobs.some((j) => /candidature|propos|services|disponible/i.test(j.title)));
  });

  it("dédoublonne TOC et H5 du même poste", () => {
    assert.equal(parseClaudePoirierExcavation(`${FIXTURE}${FIXTURE}`, BASE).length, 2);
  });

  it("renvoie [] si aucune offre", () => {
    assert.deepEqual(
      parseClaudePoirierExcavation("<html><body><h5>CANDIDATURE SPONTANÉE</h5></body></html>", BASE),
      [],
    );
  });
});
