import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAutomationDrummond } from "./automation-drummond.js";

const FIXTURE = `
<nav>
  <ul>
    <li><a href="/emplois/">Carrières</a>
      <ul>
        <li><a href="/🔧-panelier-monteur-de-panneaux-de-controle/">🔧 Panelier – Monteur de panneaux de contrôle</a></li>
        <li><a href="/offre-demploi-electricien-electricienne-industrielle-license-c/">Électricien industriel</a></li>
      </ul>
    </li>
  </ul>
</nav>
<article>
  <div class="entry-content">
    <h1>Carrières chez Automation Drummond</h1>
    <h2>Postes disponibles</h2>
    <p>👉 <strong>Panelier – Monteur de panneaux de contrôle</strong><br>
    Fabrication et câblage de panneaux en atelier<br>
    👉 <a href="https://automationdrummond.com/%f0%9f%94%a7-panelier-monteur-de-panneaux-de-controle/">[Voir le poste]</a></p>
    <p>👉 <strong>Électricien industriel</strong><br>
    Installation, modification et dépannage en milieu industriel<br>
    👉 <a href="/offre-demploi-electricien-electricienne-industrielle-license-c/">[Voir le poste]</a></p>
    <h2>Postuler</h2>
    <p>Tu peux envoyer ton CV directement à : info@automationdrummond.com</p>
  </div>
</article>
`;

describe("parseAutomationDrummond", () => {
  it("extrait les postes de la section « Postes disponibles », pas le menu", () => {
    const jobs = parseAutomationDrummond(FIXTURE);
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0]!.title, "Panelier – Monteur de panneaux de contrôle");
    assert.match(jobs[0]!.url, /panelier-monteur-de-panneaux-de-controle/);
    assert.equal(jobs[0]!.location, "Victoriaville, QC");
    assert.match(jobs[0]!.description ?? "", /câblage de panneaux/i);
    assert.equal(jobs[1]!.title, "Électricien industriel");
    assert.match(jobs[1]!.url, /offre-demploi-electricien/);
  });

  it("retourne une liste vide s'il n'y a aucun « Voir le poste »", () => {
    const html = `<div class="entry-content"><h1>Carrières</h1><p>Candidature spontanée</p></div>`;
    assert.deepEqual(parseAutomationDrummond(html), []);
  });
});
