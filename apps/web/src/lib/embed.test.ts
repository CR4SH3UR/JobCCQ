import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { embedPath, embedSnippet, embedUrl } from "./embed.js";

describe("embed widget", () => {
  it("construit le chemin et l'URL du widget", () => {
    assert.equal(embedPath("pomerleau"), "/embed/pomerleau/");
    assert.match(embedUrl("pomerleau", "https://jobccqc.ca"), /\/embed\/pomerleau\/$/);
  });

  it("génère un snippet iframe collable", () => {
    const html = embedSnippet("pomerleau", "Pomerleau", "https://jobccqc.ca");
    assert.match(html, /<iframe /);
    assert.match(html, /src="https:\/\/jobccqc\.ca\/embed\/pomerleau\/"/);
    assert.match(html, /Pomerleau/);
  });
});
