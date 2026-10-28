import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseQuantum } from "./quantum-ca.js";

const BASE = "https://quantum.ca/jobs/1002981-Contremaitre-de-chantier-travaux-civil-/";

// Fixture fidèle au JSON-LD réel de Quantum : l'employeur final est masqué
// (hiringOrganization sans nom), la description est DOUBLE-échappée
// (« &amp;#233; » dans le <script>) et le salaire n'a pas de montant.
const FIXTURE = `<!doctype html><html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org/",
  "@type": "JobPosting",
  "title": "Contremaitre de chantier – travaux civil ",
  "datePosted": "2026-10-15T00:00:00.000Z",
  "validThrough": "2026-11-14T23:59:59.999Z",
  "employmentType": null,
  "hiringOrganization": { "@type": "Organization" },
  "jobLocation": { "@type": "Place", "address": { "@type": "PostalAddress", "addressCountry": "", "addressRegion": "Rigaud, QC" } },
  "baseSalary": { "@type": "MonetaryAmount", "currency": "£", "value": { "@type": "QuantitativeValue", "unitText": "YEAR" } },
  "description": "Poste : contremaitre de chantier &amp;#150; travaux civils Tu as de l&amp;#146;exp&amp;#233;rience en travaux civils et tu aimes coordonner les op&amp;#233;rations sur le chantier ?"
}
</script>
</head><body></body></html>`;

describe("parseQuantum", () => {
  it("extrait l'offre depuis le JSON-LD JobPosting", () => {
    const jobs = parseQuantum(FIXTURE, BASE);
    assert.equal(jobs.length, 1);
    const job = jobs[0]!;
    assert.equal(job.sourceId, "quantum-ca");
    assert.equal(job.title, "Contremaitre de chantier – travaux civil");
    assert.equal(job.company, "Quantum"); // employeur masqué → repli sur l'agence
    assert.equal(job.url, BASE); // URL propre, sans fragment
    assert.equal(job.location, "Rigaud, QC");
    assert.equal(job.postedAt, "2026-10-15T00:00:00.000Z");
  });

  it("décode la description double-échappée (entités CP1252)", () => {
    const { description } = parseQuantum(FIXTURE, BASE)[0]!;
    assert.ok(description, "description présente");
    assert.ok(description!.includes("travaux civils"), "texte lisible");
    assert.ok(description!.includes("expérience"), "é décodé");
    assert.ok(description!.includes("–"), "tiret demi-cadratin décodé (&#150;)");
    assert.ok(!/&#?\w+;/.test(description!), "plus aucune entité résiduelle");
  });

  it("n'invente pas de salaire quand aucun montant n'est fourni", () => {
    const job = parseQuantum(FIXTURE, BASE)[0]!;
    assert.equal(job.salaryMin, undefined);
    assert.equal(job.salaryMax, undefined);
    assert.equal(job.salaryPeriod, undefined);
  });

  it("renvoie [] si la page n'expose aucun JobPosting", () => {
    assert.deepEqual(parseQuantum("<html><body>Aucune offre</body></html>", BASE), []);
  });
});
