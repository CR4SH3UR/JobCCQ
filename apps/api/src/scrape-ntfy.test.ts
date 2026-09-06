import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatScrapeNtfy, type ScrapeNtfyRun } from "./scrape-ntfy.js";

const run = (partial: Partial<ScrapeNtfyRun> & Pick<ScrapeNtfyRun, "sourceId">): ScrapeNtfyRun => ({
  status: "success",
  found: 0,
  inserted: 0,
  updated: 0,
  ...partial,
});

describe("formatScrapeNtfy", () => {
  it("résume un scrape ciblé avec le diff des titres", () => {
    const text = formatScrapeNtfy([
      run({
        sourceId: "caf",
        name: "Charles-Auguste Fortier",
        found: 18,
        inserted: 2,
        updated: 16,
        diff: {
          added: [
            { title: "Soudeur" },
            { title: "Manœuvre" },
          ],
          changed: [{ title: "Déneigement 2026-2027" }],
          removed: [],
        },
      }),
    ]);
    assert.match(text, /1 source/);
    assert.match(text, /\+2/);
    assert.match(text, /Charles-Auguste Fortier/);
    assert.match(text, /\+ Soudeur/);
    assert.match(text, /\+ Manœuvre/);
    assert.match(text, /~ Déneigement/);
  });

  it("liste les erreurs et les retraits", () => {
    const text = formatScrapeNtfy([
      run({
        sourceId: "boom",
        name: "Boom",
        status: "error",
        error: "timeout",
      }),
      run({
        sourceId: "acme",
        name: "Acme",
        found: 1,
        diff: { added: [], changed: [], removed: [{ title: "Ancien poste" }] },
      }),
    ]);
    assert.match(text, /1 erreur/);
    assert.match(text, /❌ Boom/);
    assert.match(text, /timeout/);
    assert.match(text, /- Ancien poste/);
  });

  it("ne dit rien s'il n'y a aucun run", () => {
    assert.match(formatScrapeNtfy([]), /Aucun scrape récent/);
  });
});
