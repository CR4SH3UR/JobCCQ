import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { followUpEmailDraft, followUpMailto } from "./follow-up-email.js";

describe("followUpEmailDraft", () => {
  it("rédige une relance postulé", () => {
    const d = followUpEmailDraft({
      status: "postule",
      title: "Électricien",
      company: "Hamel",
      url: "https://jobccqc.ca/emplois/x/",
    });
    assert.match(d.subject, /Relance/);
    assert.match(d.body, /Hamel/);
    assert.match(d.body, /Électricien/);
    assert.ok(followUpMailto(d).startsWith("mailto:?"));
  });

  it("adapte le texte à l'entrevue", () => {
    const d = followUpEmailDraft({ status: "entrevue", title: "Grutier", company: "EBC" });
    assert.match(d.subject, /entrevue/i);
    assert.match(d.body, /entrevue/);
  });
});
