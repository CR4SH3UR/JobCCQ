import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { failingScrapers } from "./scraper-health.js";

const NOW = Date.parse("2026-09-05T12:00:00.000Z");

describe("failingScrapers", () => {
  it("liste les sources dont le dernier run est en erreur, avec l'ancienneté", () => {
    const out = failingScrapers(
      [
        { sourceId: "acme", status: "error", at: "2026-09-01T12:00:00.000Z", error: "timeout" },
        { sourceId: "okco", status: "success", at: "2026-09-05T10:00:00.000Z" },
        { sourceId: "beta", status: "error", at: "2026-09-04T12:00:00.000Z", error: "404" },
      ],
      new Map([
        ["acme", "2026-08-20T12:00:00.000Z"],
        ["okco", "2026-09-05T10:00:00.000Z"],
      ]),
      { acme: "Acme", beta: "Beta", okco: "Ok Co" },
      NOW,
    );
    assert.deepEqual(
      out.map((s) => s.sourceId),
      ["acme", "beta"],
    );
    assert.equal(out[0]?.daysSinceSuccess, 16);
    assert.equal(out[0]?.name, "Acme");
    assert.equal(out[1]?.daysSinceSuccess, 1);
    assert.equal(out[1]?.lastSuccessAt, null);
  });

  it("ignore les sources saines", () => {
    assert.deepEqual(
      failingScrapers([{ sourceId: "x", status: "success", at: "2026-09-05T00:00:00.000Z" }], new Map(), {}),
      [],
    );
  });
});
