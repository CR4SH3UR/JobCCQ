import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diffDiscovered, type DiffEmployer } from "./discovered-diff.js";

const e = (id: string, extra: Partial<DiffEmployer> = {}): DiffEmployer => ({
  id,
  name: id,
  careersUrl: `https://x/${id}`,
  method: "html",
  ...extra,
});

describe("diffDiscovered", () => {
  it("détecte ajouts, retraits et modifications de champs", () => {
    const before = [e("a", { verified: false }), e("b"), e("c")];
    const after = [
      e("a", { verified: true }), // modifié (verified)
      e("b", { careersUrl: "https://x/b2" }), // modifié (careersUrl)
      // c retiré
      e("d"), // ajouté
    ];
    const d = diffDiscovered(before, after);
    assert.deepEqual(d.added.map((x) => x.id), ["d"]);
    assert.deepEqual(d.removed.map((x) => x.id), ["c"]);
    assert.deepEqual(d.modified.map((x) => x.id).sort(), ["a", "b"]);
    assert.equal(d.total, 4);

    const a = d.modified.find((m) => m.id === "a")!;
    assert.deepEqual(a.changes, [{ field: "verified", before: false, after: true }]);
  });

  it("aucun changement → diff vide", () => {
    const list = [e("a"), e("b", { sectors: ["Résidentiel"] })];
    const d = diffDiscovered(list, list.map((x) => ({ ...x })));
    assert.equal(d.total, 0);
    assert.deepEqual(d.modified, []);
  });

  it("enabled absent ≡ activé (pas de faux diff)", () => {
    const d = diffDiscovered([e("a")], [e("a", { enabled: true })]);
    assert.equal(d.total, 0);
    // …mais enabled:false est bien un changement
    const d2 = diffDiscovered([e("a")], [e("a", { enabled: false })]);
    assert.equal(d2.modified[0]!.changes[0]!.field, "enabled");
  });

  it("compare les tableaux (secteurs) par contenu", () => {
    const d = diffDiscovered([e("a", { sectors: ["X"] })], [e("a", { sectors: ["X", "Y"] })]);
    assert.equal(d.modified.length, 1);
    assert.equal(d.modified[0]!.changes[0]!.field, "sectors");
  });
});
