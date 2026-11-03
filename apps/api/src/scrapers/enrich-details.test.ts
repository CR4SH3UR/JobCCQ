import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBambooHrDetail, mainContentText } from "./enrich-details.js";

describe("parseBambooHrDetail", () => {
  it("extrait description et lieu depuis le JSON BambooHR", () => {
    const json = JSON.stringify({
      result: {
        jobOpening: {
          description: "<p>Nous cherchons un <strong>charpentier</strong> expérimenté.</p>",
          location: { city: "Laval", state: "Québec" },
          employmentStatusLabel: "Full-Time",
        },
      },
    });
    const d = parseBambooHrDetail(json);
    assert.ok(d);
    assert.match(d!.description ?? "", /charpentier/);
    assert.equal(d!.location, "Laval, Québec");
    assert.equal(d!.employmentTypeLabel, "Full-Time");
  });

  it("retourne null sur JSON invalide", () => {
    assert.equal(parseBambooHrDetail("pas du json"), null);
  });
});

describe("mainContentText", () => {
  it("prend le plus grand bloc de contenu utile", () => {
    const html = `
      <html><body>
        <nav>Menu</nav>
        <article class="job-description">
          ${"Paragraphe de description du poste. ".repeat(20)}
        </article>
      </body></html>`;
    const t = mainContentText(html);
    assert.ok(t && t.length >= 120);
    assert.match(t!, /description du poste/);
  });
});
