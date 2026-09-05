import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RawJob } from "@jobccq/shared";
import { dedupeBaulne } from "./baulne.js";

const raw = (title: string, url: string): RawJob => ({
  sourceId: "baulne-ca",
  url,
  title,
  company: "Baulne",
});

describe("dedupeBaulne", () => {
  it("fusionne les doublons (préfixe « Bureau de … – » + variantes) et pose le lieu", () => {
    const input = [
      raw("Bureau de Montréal – Contremaître chauffagiste", "https://www.baulne.ca/#a"),
      raw("Contremaitre chauffagiste", "https://www.baulne.ca/#b"),
      raw("Gestionnaire de terrain (Répartiteur/répartitrice)", "https://www.baulne.ca/#c"),
      raw("Gestionnaire de Terrain (Répartiteur(trice))", "https://www.baulne.ca/#d"),
      raw("Frigoriste commercial", "https://www.baulne.ca/#e"),
    ];
    const out = dedupeBaulne(input);
    assert.equal(out.length, 3);
    const titles = out.map((j) => j.title);
    assert.ok(titles.includes("Contremaître chauffagiste"), "préfixe de bureau retiré, accents conservés");
    assert.ok(titles.some((t) => /^Gestionnaire de terrain/i.test(t)));
    assert.ok(titles.includes("Frigoriste commercial"));
    assert.ok(out.every((j) => j.location === "Montréal, QC"));
    assert.ok(!titles.some((t) => /^Bureau de/i.test(t)));
  });
});
