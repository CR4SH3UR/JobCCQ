import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claveauEtFilsScraper } from "./claveauetfils.js";

const BASE = "https://www.jobillico.com/fr/employeurs/claveau-fils-inc/voir-liste-emplois";

const FIXTURE = `<html><body>
<script type="application/ld+json">
{"@context":"http://schema.org","@type":"ItemList","numberOfItems":2,"itemListElement":[
  {"@type":"ListItem","position":1,"url":"https://www.jobillico.com/fr/offre-d-emploi/claveau-fils-inc/camionneur/17501148","name":"Camionneur"},
  {"@type":"ListItem","position":2,"url":"https://www.jobillico.com/fr/offre-d-emploi/claveau-fils-inc/journalier/16622763","name":"Journalier"}
]}
</script>
</body></html>`;

describe("claveauEtFilsScraper.parseList", () => {
  it("extrait les postes de l'ItemList Jobillico", () => {
    const jobs = claveauEtFilsScraper.parseList!(FIXTURE, BASE);
    assert.equal(jobs.length, 2);

    const cam = jobs.find((j) => j.title === "Camionneur");
    assert.ok(cam);
    assert.equal(cam.company, "Claveau Et Fils inc.");
    assert.equal(cam.sourceId, "claveauetfils-ca");
    assert.equal(
      cam.url,
      "https://www.jobillico.com/fr/offre-d-emploi/claveau-fils-inc/camionneur/17501148",
    );

    assert.ok(jobs.find((j) => j.title === "Journalier"));
  });

  it("renvoie [] si aucune offre", () => {
    assert.deepEqual(claveauEtFilsScraper.parseList!("<html></html>", BASE), []);
  });
});
