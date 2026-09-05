import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { refineCareers } from "./careers.js";

const ld = (title: string, url: string, loc?: string) =>
  `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title,
    description: "Un poste.",
    datePosted: "2026-01-01",
    hiringOrganization: { "@type": "Organization", name: "X" },
    url,
    ...(loc
      ? { jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: loc } } }
      : {}),
  })}</script>`;

const FIXTURE = `
${ld("Frigoriste", "https://x.ca/emplois/frigoriste")}
${ld("Certificat de compétence COMPAGNON de la CCQ", "https://x.ca/emplois/cert")}
`;

describe("refineCareers", () => {
  it("écarte les titres filtrés (drop) et pose le lieu par défaut", () => {
    const s = refineCareers(
      { id: "x", company: "X", careersUrl: "https://x.ca/carrieres/" },
      { drop: /certificat de comp/i, defaultLocation: "Beloeil, QC" },
    );
    const jobs = s.parseList!(FIXTURE, "https://x.ca/carrieres/");
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]!.title, "Frigoriste");
    assert.equal(jobs[0]!.location, "Beloeil, QC");
  });
});
