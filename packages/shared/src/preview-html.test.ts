import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { previewFromHtml } from "./preview-html.js";

describe("previewFromHtml", () => {
  it("extrait les JobPosting JSON-LD", () => {
    const html = `<html><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Électricien",
      hiringOrganization: { name: "Acme" },
      url: "https://acme.ca/jobs/1",
      jobLocation: { address: { addressLocality: "Montréal" } },
    })}</script></html>`;
    const out = previewFromHtml(html, "https://acme.ca/carrieres/");
    assert.equal(out.length, 1);
    assert.equal(out[0]?.title, "Électricien");
    assert.equal(out[0]?.url, "https://acme.ca/jobs/1");
    assert.equal(out[0]?.city, "Montréal");
  });

  it("extrait les items d'un flux RSS", () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title>Plombier</title><link>https://acme.ca/p1</link></item>
    </channel></rss>`;
    const out = previewFromHtml(xml, "https://acme.ca/feed/");
    assert.equal(out.length, 1);
    assert.equal(out[0]?.title, "Plombier");
    assert.equal(out[0]?.url, "https://acme.ca/p1");
  });
});
