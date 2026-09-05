import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBetonSurface } from "./betonsurface.js";

const FIXTURE = `
<div id="mk-tabs" class="wpb_tabs">
  <div class="wpb_tab">
    <h2>APPLICATEUR</h2>
    <p>Tu es une personne énergique qui aime le travail manuel.</p>
    <h3>Votre future mission :</h3>
    <p>Appliquer des revêtements de plancher.</p>
    <a class="mk-button" href="https://www.betonsurface.ca/contact/emplois/applicateur/">DÉPOSER MA CANDIDATURE</a>
  </div>
  <div class="wpb_tab">
    <h2>CHEF D'ÉQUIPE-APPLICATEUR</h2>
    <p>Le chef d'équipe coordonne les applicateurs.</p>
    <a class="mk-button" href="https://www.betonsurface.ca/contact/emplois/chef-dequipe-applicateur/">DÉPOSER MA CANDIDATURE</a>
  </div>
  <div class="wpb_tab">
    <h2></h2>
  </div>
</div>
`;

describe("parseBetonSurface", () => {
  it("extrait titre, URL et description de chaque onglet", () => {
    const jobs = parseBetonSurface(FIXTURE);
    assert.equal(jobs.length, 2);

    assert.equal(jobs[0]!.title, "APPLICATEUR");
    assert.equal(jobs[0]!.url, "https://www.betonsurface.ca/contact/emplois/applicateur/");
    assert.ok(jobs[0]!.description?.includes("Votre future mission"));
    assert.ok(!jobs[0]!.description?.includes("DÉPOSER"));

    assert.equal(jobs[1]!.title, "CHEF D'ÉQUIPE-APPLICATEUR");
    assert.equal(jobs[1]!.url, "https://www.betonsurface.ca/contact/emplois/chef-dequipe-applicateur/");
  });

  it("renvoie un tableau vide si les onglets sont absents", () => {
    assert.deepEqual(parseBetonSurface("<html></html>"), []);
  });
});
