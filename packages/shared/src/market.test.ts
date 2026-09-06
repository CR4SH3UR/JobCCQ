import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aggregateMarketHistory, type HiringHistory } from "./hiring-history.js";
import { CCQ_WORKFORCE_SOURCE, tensionPer1000, unknownWorkforceIds, workforceFor } from "./ccq-workforce.js";

describe("aggregateMarketHistory", () => {
  it("somme les offres par jour, tous employeurs confondus", () => {
    const history: HiringHistory = {
      a: [
        { at: "2026-01-01T08:00:00Z", found: 3 },
        { at: "2026-01-02T08:00:00Z", found: 5 },
      ],
      b: [
        { at: "2026-01-01T09:00:00Z", found: 2 },
        { at: "2026-01-02T10:00:00Z", found: 4 },
      ],
    };
    const series = aggregateMarketHistory(history);
    assert.deepEqual(series, [
      { at: "2026-01-01", found: 5 }, // 3 + 2
      { at: "2026-01-02", found: 9 }, // 5 + 4
    ]);
  });

  it("ignore les points invalides et garde les N derniers jours", () => {
    const history: HiringHistory = {
      a: [
        { at: "", found: 9 },
        { at: "2026-01-01T00:00:00Z", found: Number.NaN },
        { at: "2026-01-02T00:00:00Z", found: 1 },
        { at: "2026-01-03T00:00:00Z", found: 2 },
      ],
    };
    const series = aggregateMarketHistory(history, 1);
    assert.deepEqual(series, [{ at: "2026-01-03", found: 2 }]);
  });

  it("historique vide → série vide", () => {
    assert.deepEqual(aggregateMarketHistory({}), []);
  });
});

describe("ccq-workforce", () => {
  it("aucune clé d'effectif ne référence un métier inconnu", () => {
    assert.deepEqual(unknownWorkforceIds(), []);
  });

  it("expose les effectifs CCQ 2025 utilisés par le baromètre", () => {
    assert.equal(CCQ_WORKFORCE_SOURCE.year, 2025);
    assert.equal(workforceFor("electricien"), 25149);
    assert.equal(workforceFor("charpentier-menuisier"), 56432);
    assert.equal(workforceFor("operateur-equipement-lourd"), 14740);
    assert.equal(workforceFor("plombier"), null);
    assert.equal(workforceFor("contremaitre"), null);
  });

  it("tensionPer1000 : offres pour 1000 travailleurs, null si effectif absent", () => {
    assert.equal(tensionPer1000(50, 10000), 5);
    assert.equal(tensionPer1000(50, null), null);
    assert.equal(tensionPer1000(50, 0), null);
  });
});
