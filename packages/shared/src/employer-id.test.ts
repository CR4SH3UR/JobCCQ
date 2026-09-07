import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeEmployerId,
  remapIdSet,
  remapKeyedRecord,
  renameEmployerInList,
  validateEmployerIdChange,
} from "./employer-id.js";

describe("normalizeEmployerId", () => {
  it("passe en minuscules et remplace espaces / ponctuation par des tirets", () => {
    assert.equal(normalizeEmployerId("  ACME Inc. "), "acme-inc");
    assert.equal(normalizeEmployerId("Ma Compagnie.com"), "ma-compagnie-com");
  });

  it("retire les accents", () => {
    assert.equal(normalizeEmployerId("Béton Québec"), "beton-quebec");
  });

  it("écrase les séparateurs répétés et les tirets de bord", () => {
    assert.equal(normalizeEmployerId("--Foo___Bar--"), "foo-bar");
  });
});

describe("validateEmployerIdChange", () => {
  const current = "acme-com";
  const taken = ["acme-com", "autre-inc"];

  it("accepte un slug libre distinct", () => {
    assert.deepEqual(validateEmployerIdChange(current, "Acme Québec", taken), {
      ok: true,
      newId: "acme-quebec",
    });
  });

  it("refuse le vide, l'inchangé et la collision", () => {
    const empty = validateEmployerIdChange(current, "   ", taken);
    const same = validateEmployerIdChange(current, "ACME-COM", taken);
    const clash = validateEmployerIdChange(current, "autre-inc", taken);
    assert.equal(empty.ok, false);
    assert.equal(same.ok, false);
    assert.equal(clash.ok, false);
    if (!empty.ok) assert.equal(empty.error, "empty");
    if (!same.ok) assert.equal(same.error, "unchanged");
    if (!clash.ok) assert.equal(clash.error, "taken");
  });

  it("accepte un Set comme liste d'ids existants", () => {
    const r = validateEmployerIdChange("a", "b", new Set(["a"]));
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.newId, "b");
  });
});

describe("renameEmployerInList / remap", () => {
  it("change l'id de la fiche visée seulement", () => {
    const list = [
      { id: "old", name: "A" },
      { id: "keep", name: "B" },
    ];
    assert.deepEqual(renameEmployerInList(list, "old", "new"), [
      { id: "new", name: "A" },
      { id: "keep", name: "B" },
    ]);
  });

  it("déplace les clés de maps et d'ensembles", () => {
    assert.deepEqual(remapKeyedRecord({ old: 3, keep: 1 }, "old", "new"), { new: 3, keep: 1 });
    assert.deepEqual([...remapIdSet(new Set(["old", "x"]), "old", "new")].sort(), ["new", "x"]);
    assert.deepEqual(remapKeyedRecord({ keep: 1 }, "old", "new"), { keep: 1 });
  });
});
