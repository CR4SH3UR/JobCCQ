import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collapseHiringPoints, sparklinePoints } from "./hiring-history.js";

describe("collapseHiringPoints", () => {
  it("trie et plafonne", () => {
    const got = collapseHiringPoints(
      [
        { at: "2026-03-01T00:00:00.000Z", found: 3 },
        { at: "2026-01-01T00:00:00.000Z", found: 1 },
        { at: "2026-02-01T00:00:00.000Z", found: 2 },
      ],
      2,
    );
    assert.equal(got.length, 2);
    assert.equal(got[0]?.found, 2);
    assert.equal(got[1]?.found, 3);
  });
});

describe("sparklinePoints", () => {
  it("vide si moins de 2 valeurs", () => {
    assert.equal(sparklinePoints([]), "");
    assert.equal(sparklinePoints([4]), "");
  });

  it("monte de gauche à droite si les valeurs montent", () => {
    const pts = sparklinePoints([1, 10], 100, 40, 0);
    const [a, b] = pts.split(" ");
    const y1 = Number(a?.split(",")[1]);
    const y2 = Number(b?.split(",")[1]);
    assert.ok(y2 < y1);
  });
});
