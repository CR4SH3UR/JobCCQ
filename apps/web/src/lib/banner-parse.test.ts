import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readBannerConfig } from "./banner-parse.js";

describe("readBannerConfig", () => {
  it("lit une config complète", () => {
    const c = readBannerConfig({
      enabled: true,
      id: "beta-2026",
      emoji: "🚧",
      title: "Version beta",
      message: "— mises à jour 2×/semaine.",
      tone: "amber",
      dismissible: true,
      link: { kind: "contact", label: "Écris-nous", subject: "Retour" },
    });
    assert.equal(c.enabled, true);
    assert.equal(c.id, "beta-2026");
    assert.equal(c.tone, "amber");
    assert.deepEqual(c.link, { kind: "contact", label: "Écris-nous", subject: "Retour" });
  });

  it("applique des replis sûrs sur une config vide", () => {
    const c = readBannerConfig({});
    assert.equal(c.enabled, true); // activé par défaut
    assert.equal(c.id, "banner");
    assert.equal(c.tone, "amber"); // couleur inconnue → amber
    assert.equal(c.dismissible, true);
    assert.deepEqual(c.link, { kind: "none" });
  });

  it("retombe sur amber pour une couleur inconnue", () => {
    assert.equal(readBannerConfig({ tone: "fuchsia" }).tone, "amber");
  });

  it("respecte enabled=false et dismissible=false explicites", () => {
    const c = readBannerConfig({ enabled: false, dismissible: false });
    assert.equal(c.enabled, false);
    assert.equal(c.dismissible, false);
  });

  it("normalise un lien url sans libellé (utilise l'URL)", () => {
    const c = readBannerConfig({ link: { kind: "url", href: "https://ex.ca" } });
    assert.deepEqual(c.link, { kind: "url", label: "https://ex.ca", href: "https://ex.ca" });
  });

  it("ignore un lien url sans href", () => {
    const c = readBannerConfig({ link: { kind: "url", label: "X" } });
    assert.deepEqual(c.link, { kind: "none" });
  });
});
