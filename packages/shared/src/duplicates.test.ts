import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attachDuplicateAlts,
  collapseDuplicates,
  duplicateGroups,
  duplicateKey,
  normalizeCompany,
  normalizeTitle,
  pickCanonical,
} from "./duplicates.js";
import { applyQuery } from "./filters.js";
import type { Job, JobQuery } from "./types.js";

let seq = 0;
function job(partial: Partial<Job> & Pick<Job, "title" | "sourceId">): Job {
  seq += 1;
  return {
    id: `d${seq}`,
    url: `https://example.com/${partial.sourceId}/${seq}`,
    company: "Pomerleau",
    tags: [],
    languages: [],
    scrapedAt: "2026-09-01T12:00:00.000Z",
    ...partial,
  };
}

const q = (): JobQuery =>
  ({ sort: "recent", page: 1, pageSize: 50 }) as JobQuery;

describe("normalizeCompany / normalizeTitle", () => {
  it("ignore la forme juridique", () => {
    assert.equal(normalizeCompany("Pomerleau inc."), normalizeCompany("Pomerleau"));
    assert.equal(normalizeCompany("EBC Ltée"), normalizeCompany("EBC"));
  });

  it("retire le lieu collé au titre", () => {
    assert.equal(normalizeTitle("Charpentier - Montréal"), normalizeTitle("Charpentier"));
    assert.equal(normalizeTitle("Électricien (Laval)"), normalizeTitle("Électricien"));
  });
});

describe("duplicateKey", () => {
  it("rapproche deux portails du même poste", () => {
    const a = job({
      title: "Charpentier-menuisier - Montréal",
      sourceId: "pomerleau",
      city: "Montréal",
    });
    const b = job({
      title: "Charpentier-menuisier",
      sourceId: "pomerleau-jobillico",
      company: "Pomerleau Inc.",
      city: "Montreal",
    });
    assert.equal(duplicateKey(a), duplicateKey(b));
  });

  it("sépare deux villes", () => {
    const a = job({ title: "Charpentier", sourceId: "a", city: "Montréal" });
    const b = job({ title: "Charpentier", sourceId: "b", city: "Québec" });
    assert.notEqual(duplicateKey(a), duplicateKey(b));
  });
});

describe("duplicateGroups / collapseDuplicates", () => {
  const careers = job({
    title: "Manœuvre",
    sourceId: "ebc",
    city: "Laval",
    description: "x".repeat(200),
  });
  const board = job({
    title: "Manœuvre",
    sourceId: "ebc-jobillico",
    city: "Laval",
    description: "court",
  });
  const other = job({
    title: "Estimateur",
    sourceId: "ebc",
    city: "Laval",
  });
  const twinSameSource = job({
    title: "Manœuvre",
    sourceId: "ebc",
    city: "Laval",
  });

  it("ne fusionne pas deux offres de la même source", () => {
    const groups = duplicateGroups([careers, twinSameSource]);
    assert.equal(groups.length, 0);
  });

  it("fusionne deux sources et garde la fiche la plus complète", () => {
    const groups = duplicateGroups([board, careers, other]);
    assert.equal(groups.length, 1);
    assert.equal(pickCanonical(groups[0]!).id, careers.id);

    const collapsed = collapseDuplicates([board, careers, other]);
    assert.equal(collapsed.length, 2);
    const kept = collapsed.find((j) => j.id === careers.id);
    assert.ok(kept?.alsoOn?.some((a) => a.sourceId === "ebc-jobillico"));
    assert.ok(collapsed.some((j) => j.id === other.id));
  });

  it("applyQuery déduplique le total", () => {
    const result = applyQuery([board, careers, other], q());
    assert.equal(result.total, 2);
  });

  it("attache les alternatives sans masquer l'offre (fiche détail)", () => {
    const annotated = attachDuplicateAlts(board, [board, careers, other]);
    assert.ok(annotated.alsoOn?.some((a) => a.id === careers.id));
    assert.equal(annotated.id, board.id);
  });
});
