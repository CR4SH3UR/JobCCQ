import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseNjoyn, isNjoynBlocked } from "./njoyn.js";

const BASE = "https://bellemare.njoyn.com/cl3/xweb/Xweb.asp?page=joblisting&CLID=53428&lang=2";

// Table Njoyn typique : intitulé-lien vers page=jobdetails, cellule lieu, et un
// bouton « Postuler » (même JobId → à dédupliquer).
const FIXTURE = `
<table id="joblisting">
  <tr><th>Titre</th><th>Lieu</th><th></th></tr>
  <tr>
    <td><a href="Xweb.asp?clid=53428&page=jobdetails&lang=2&JobId=1001">Journalier de production</a></td>
    <td>Trois-Rivières, QC</td>
    <td><a class="apply" href="Xweb.asp?clid=53428&page=jobdetails&lang=2&JobId=1001">Postuler</a></td>
  </tr>
  <tr>
    <td><a href="Xweb.asp?clid=53428&page=jobdetails&lang=2&JobId=1002">Mécanicien de machinerie lourde</a></td>
    <td>Bécancour, QC</td>
    <td><a class="apply" href="Xweb.asp?clid=53428&page=jobdetails&lang=2&JobId=1002">Postuler</a></td>
  </tr>
</table>
`;

describe("parseNjoyn", () => {
  it("extrait les postes (titre + lieu), déduplique le bouton Postuler", () => {
    const jobs = parseNjoyn(FIXTURE, BASE, "bellemare-njoyn", "Groupe Bellemare", "Trois-Rivières, QC");
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0]!.title, "Journalier de production");
    assert.equal(jobs[0]!.location, "Trois-Rivières, QC");
    assert.match(jobs[0]!.url, /page=jobdetails.*JobId=1001/i);
    assert.equal(jobs[1]!.title, "Mécanicien de machinerie lourde");
    assert.equal(jobs[1]!.location, "Bécancour, QC");
    // le lien « Postuler » ne crée pas de doublon
    assert.ok(!jobs.some((j) => /postuler/i.test(j.title)));
  });

  it("applique le lieu par défaut quand la ligne n'indique pas de ville", () => {
    const noLoc = `<table><tr><td><a href="Xweb.asp?page=jobdetails&JobId=7">Grutier</a></td></tr></table>`;
    const jobs = parseNjoyn(noLoc, BASE, "bellemare-njoyn", "Groupe Bellemare", "Trois-Rivières, QC");
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]!.location, "Trois-Rivières, QC");
  });

  it("ne renvoie rien face au captcha anti-robot (pas de purge)", () => {
    const captcha = "<html><head><title>Radware Captcha Page</title></head><body>captcha</body></html>";
    assert.equal(isNjoynBlocked(captcha), true);
    assert.equal(parseNjoyn(captcha, BASE, "bellemare-njoyn", "Groupe Bellemare").length, 0);
  });
});
