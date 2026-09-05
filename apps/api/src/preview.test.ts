import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toPreviewSample } from "./preview.js";

describe("toPreviewSample", () => {
  it("écarte les titres parasites et garde les vrais postes", () => {
    const out = toPreviewSample([
      { sourceId: "acme", url: "https://acme.ca/jobs/1", title: "Électricien", company: "Acme" },
      { sourceId: "acme", url: "https://acme.ca/jobs/2", title: "Postuler", company: "Acme" },
      { sourceId: "acme", url: "pas-une-url", title: "Charpentier", company: "Acme" },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.title, "Électricien");
    assert.equal(out[0]?.url, "https://acme.ca/jobs/1");
  });
});
