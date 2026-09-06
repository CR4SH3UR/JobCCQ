import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendJobHistory, formatHistoryEvent, parseJobHistory } from "./job-history.js";

describe("job-history", () => {
  it("parse une liste JSON et ignore le reste", () => {
    assert.deepEqual(parseJobHistory(null), []);
    assert.equal(parseJobHistory(`[{"at":"2026-01-01","field":"salary","from":"20","to":"25"}]`).length, 1);
  });

  it("n'ajoute pas un doublon consécutif identique", () => {
    const e = { at: "a", field: "title" as const, from: "A", to: "B" };
    const once = appendJobHistory([], e);
    assert.equal(appendJobHistory(once, { ...e, at: "b" }).length, 1);
  });

  it("libellé lisible", () => {
    assert.match(formatHistoryEvent({ at: "x", field: "reactivated" }), /nouveau/);
  });
});
