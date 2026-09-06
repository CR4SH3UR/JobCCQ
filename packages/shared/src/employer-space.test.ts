import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  draftToJob,
  employerJobId,
  filterByEmployers,
  isEmployerPostedJobId,
  jobDetailHref,
  parseEmployerPatch,
  validateEmployerJobDraft,
} from "./employer-space.js";

describe("employer-space", () => {
  it("valide un brouillon d'offre", () => {
    assert.equal(validateEmployerJobDraft({ title: "ab" }).ok, false);
    const ok = validateEmployerJobDraft({ title: "Manœuvre de chantier", url: "https://ex.test/postuler" });
    assert.equal(ok.ok, true);
    assert.equal(ok.value?.title, "Manœuvre de chantier");
  });

  it("fabrique une offre avec id e-…", () => {
    const job = draftToJob(
      { title: "Manœuvre de chantier" },
      { id: "hamel-construction", name: "Hamel" },
      "2026-09-06T00:00:00.000Z",
    );
    assert.equal(isEmployerPostedJobId(job.id), true);
    assert.equal(job.sourceId, "hamel-construction");
    assert.equal(job.company, "Hamel");
    assert.equal(jobDetailHref(job.id).startsWith("/emplois/e/?id="), true);
    assert.equal(employerJobId("hamel-construction", "Manœuvre de chantier", "2026-09-06T00:00:00.000Z"), job.id);
  });

  it("parse un patch fiche (logo https seulement)", () => {
    assert.deepEqual(parseEmployerPatch({ description: "  Bonjour  ", logoUrl: "ftp://x" }), {
      description: "Bonjour",
    });
    assert.equal(parseEmployerPatch({ logoUrl: "https://cdn.ex/logo.png" }).logoUrl, "https://cdn.ex/logo.png");
  });

  it("filtre les stats par employeur réclamé", () => {
    const rows = [
      { sourceId: "hamel-construction", n: 1 },
      { sourceId: "pomerleau", n: 2 },
    ];
    assert.deepEqual(filterByEmployers(rows, ["hamel-construction"]), [{ sourceId: "hamel-construction", n: 1 }]);
  });
});
