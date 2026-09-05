import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APPLICATION_STATUSES,
  parseApplicationStore,
  upsertApplication,
  removeApplication,
} from "./application-record.js";

describe("parseApplicationStore", () => {
  it("migre l'ancien format (liste d'ids) vers des fiches « postulé »", () => {
    const m = parseApplicationStore(["job-a", "job-b"]);
    assert.equal(m.size, 2);
    assert.equal(m.get("job-a")?.status, "postule");
    assert.equal(m.get("job-b")?.status, "postule");
  });

  it("lit le format enrichi (statut, note, rappel)", () => {
    const m = parseApplicationStore({
      "job-a": { status: "entrevue", note: "Relancer jeudi", remindAt: "2026-09-10" },
    });
    assert.equal(m.get("job-a")?.status, "entrevue");
    assert.equal(m.get("job-a")?.note, "Relancer jeudi");
    assert.equal(m.get("job-a")?.remindAt, "2026-09-10");
  });

  it("ignore un statut inconnu", () => {
    const m = parseApplicationStore({ x: { status: "zzz" } });
    assert.equal(m.get("x")?.status, "postule");
  });
});

describe("upsert / remove", () => {
  it("ajoute, met à jour et retire", () => {
    let m = new Map();
    m = upsertApplication(m, "j1", { status: "a-postuler" });
    assert.equal(m.get("j1")?.status, "a-postuler");
    m = upsertApplication(m, "j1", { note: "CV envoyé" });
    assert.equal(m.get("j1")?.status, "a-postuler");
    assert.equal(m.get("j1")?.note, "CV envoyé");
    m = removeApplication(m, "j1");
    assert.equal(m.has("j1"), false);
  });
});

describe("APPLICATION_STATUSES", () => {
  it("couvre le pipeline demandé", () => {
    assert.deepEqual(
      APPLICATION_STATUSES.map((s) => s.id),
      ["a-postuler", "postule", "entrevue", "refuse", "accepte"],
    );
  });
});
