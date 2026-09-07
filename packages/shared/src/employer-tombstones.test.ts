import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addRetiredIds, dropRetiredEmployers, removeRetiredId } from "./employer-tombstones.js";

describe("dropRetiredEmployers", () => {
  it("retire les fiches ancrées d'une liste git / bundle", () => {
    const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
    assert.deepEqual(
      dropRetiredEmployers(list, new Set(["b"])).map((e) => e.id),
      ["a", "c"],
    );
  });

  it("laisse la liste intacte si aucune ancre", () => {
    const list = [{ id: "a" }];
    assert.deepEqual(dropRetiredEmployers(list, new Set()), list);
  });
});

describe("addRetiredIds / removeRetiredId", () => {
  it("accumule et libère un id réajouté", () => {
    const once = addRetiredIds(new Set(), ["x", " y "]);
    assert.deepEqual([...once].sort(), ["x", "y"]);
    assert.deepEqual([...removeRetiredId(once, "x")], ["y"]);
  });
});
