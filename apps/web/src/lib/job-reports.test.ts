import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildReportPayload,
  clipReportComment,
  labelForReportReason,
  parseReportReason,
  parseReportStatus,
} from "./job-reports-parse.js";

describe("parseReportReason", () => {
  it("n'accepte que les 3 motifs", () => {
    assert.equal(parseReportReason("expired"), "expired");
    assert.equal(parseReportReason("misleading"), "misleading");
    assert.equal(parseReportReason("duplicate"), "duplicate");
    assert.equal(parseReportReason("spam"), null);
    assert.equal(parseReportReason(""), null);
  });
});

describe("parseReportStatus / libellés", () => {
  it("reconnaît les statuts de file", () => {
    assert.equal(parseReportStatus("pending"), "pending");
    assert.equal(parseReportStatus("actioned"), "actioned");
    assert.equal(parseReportStatus("nope"), null);
  });

  it("libellé FR des motifs", () => {
    assert.match(labelForReportReason("expired"), /xpir/i);
    assert.match(labelForReportReason("misleading"), /romp/i);
    assert.match(labelForReportReason("duplicate"), /oublon/i);
  });
});

describe("clipReportComment + buildReportPayload", () => {
  it("coupe et normalise le commentaire", () => {
    assert.equal(clipReportComment("  déjà   pourvue  "), "déjà pourvue");
    assert.equal(clipReportComment("x".repeat(600)).length, 500);
  });

  it("refuse un brouillon sans id ou motif", () => {
    assert.equal(
      buildReportPayload({
        jobId: "",
        sourceId: "pomerleau",
        title: "Électricien",
        reason: "expired",
        comment: "",
      }),
      null,
    );
  });

  it("prépare un insert pending", () => {
    const row = buildReportPayload({
      jobId: "abc",
      sourceId: "pomerleau",
      title: "Électricien",
      company: "Pomerleau",
      url: "https://example.com/j",
      reason: "duplicate",
      comment: "  même poste sur EBC  ",
    });
    assert.deepEqual(row, {
      job_id: "abc",
      source_id: "pomerleau",
      title: "Électricien",
      company: "Pomerleau",
      url: "https://example.com/j",
      reason: "duplicate",
      comment: "même poste sur EBC",
      status: "pending",
    });
  });
});
