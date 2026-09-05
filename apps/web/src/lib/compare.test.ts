import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COMPARE_MAX, parseCompareIds, toggleCompareList } from "./compare.js";

describe("parseCompareIds", () => {
  it("lit jusqu'à 3 ids uniques depuis la query", () => {
    assert.deepEqual(parseCompareIds("a,b,c,d"), ["a", "b", "c"]);
    assert.deepEqual(parseCompareIds("a,a,b"), ["a", "b"]);
    assert.deepEqual(parseCompareIds(null), []);
  });
});

describe("toggleCompareList", () => {
  it("ajoute, retire, et refuse un 4e", () => {
    let ids = toggleCompareList([], "a").ids;
    ids = toggleCompareList(ids, "b").ids;
    ids = toggleCompareList(ids, "c").ids;
    assert.deepEqual(ids, ["a", "b", "c"]);
    const fourth = toggleCompareList(ids, "d");
    assert.equal(fourth.rejected, true);
    assert.deepEqual(fourth.ids, ["a", "b", "c"]);
    assert.deepEqual(toggleCompareList(ids, "b").ids, ["a", "c"]);
  });

  it("plafonne à COMPARE_MAX", () => {
    assert.equal(COMPARE_MAX, 3);
  });
});
