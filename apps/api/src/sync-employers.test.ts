import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { employersToInsert, type SyncableEmployer } from "./sync-employers.js";

const e = (id: string, extra: Partial<SyncableEmployer> = {}): SyncableEmployer => ({
  id,
  name: id,
  homepage: `https://${id}.example`,
  careersUrl: `https://${id}.example/jobs`,
  method: "html",
  ...extra,
});

describe("employersToInsert", () => {
  it("n'ajoute que les ids absents de la base", () => {
    const git = [e("ccq-construction"), e("deja-la")];
    const missing = employersToInsert(git, new Set(["deja-la"]));
    assert.deepEqual(
      missing.map((x) => x.id),
      ["ccq-construction"],
    );
  });

  it("ignore les fiches git désactivées", () => {
    const git = [e("off", { enabled: false }), e("on")];
    assert.deepEqual(
      employersToInsert(git, new Set()).map((x) => x.id),
      ["on"],
    );
  });

  it("ne fait rien si git et Turso sont alignés", () => {
    const git = [e("a"), e("b")];
    assert.deepEqual(employersToInsert(git, new Set(["a", "b"])), []);
  });

  it("déduplique un id présent deux fois dans git", () => {
    const git = [e("dup"), e("dup", { name: "Doublon" }), e("autre")];
    assert.deepEqual(
      employersToInsert(git, new Set()).map((x) => x.id),
      ["dup", "autre"],
    );
  });
});
