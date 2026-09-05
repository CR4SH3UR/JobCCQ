import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBoismassifquebec } from "./boismassifquebec.js";

const FIXTURE = `
<!DOCTYPE html>
<html>
<head>
<title>Apprenti / Compagnon peintre</title>
<script type="application/ld+json">
{
  "@context": "https://schema.org/",
  "@type": "JobPosting",
  "title": "Apprenti / Compagnon peintre",
  "description": "Sablage, décapage, tirer des joints et teinture principalement.",
  "datePosted": "May 23, 2023",
  "validThrough": "July 23, 2023",
  "employmentType": "FULL_TIME",
  "hiringOrganization": {
    "@type": "Organization",
    "name": "Bois Massif Québec",
    "sameAs": "https://www.boismassifquebec.com/"
  },
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "La Baie",
      "addressRegion": "QC",
      "addressCountry": "CA"
    }
  },
  "baseSalary": {
    "@type": "MonetaryAmount",
    "currency": "CAD",
    "value": {
      "@type": "QuantitativeValue",
      "minValue": 25,
      "maxValue": 40,
      "unitText": "HOUR"
    }
  }
}
</script>
</head>
<body>
  <h1 class="heading-style-h2">Apprenti / Compagnon peintre</h1>
</body>
</html>
`;

describe("parseBoismassifquebec", () => {
  it("extrait le poste depuis le JSON-LD", () => {
    const jobs = parseBoismassifquebec(FIXTURE);
    assert.equal(jobs.length, 1);

    const job = jobs[0]!;
    assert.equal(job.title, "Apprenti / Compagnon peintre");
    assert.equal(job.company, "Bois Massif Québec");
    assert.equal(job.location, "La Baie, QC");
    assert.equal(job.employmentType, "temps-plein");
    assert.equal(job.salaryMin, 25);
    assert.equal(job.salaryMax, 40);
    assert.equal(job.salaryPeriod, "heure");
    assert.equal(
      job.url,
      "https://www.boismassifquebec.com/emplois/apprenti-compagnon-peintre#apprenti-compagnon-peintre",
    );
  });

  it("renvoie un tableau vide si la page ne contient ni JSON-LD ni titre", () => {
    assert.deepEqual(parseBoismassifquebec("<html><body></body></html>"), []);
  });
});
