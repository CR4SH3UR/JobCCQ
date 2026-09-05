import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBetonBarretteFeed } from "./betonbarrette.js";

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <item>
    <title>Offre d&#8217;emploi &#8211; MÉCANICIEN DE CONCASSEUR</title>
    <link>https://betonbarrette.qc.ca/offre-demploi-mecanicien-de-concasseur/</link>
    <pubDate>Mon, 23 Mar 2026 14:40:07 +0000</pubDate>
    <category><![CDATA[Offre d'emploi]]></category>
    <category><![CDATA[Mécanique]]></category>
  </item>
  <item>
    <title>Offre d'emploi - Opérateur de pelle</title>
    <link>https://betonbarrette.qc.ca/offre-demploi-operateur-de-pelle/</link>
    <pubDate>Tue, 24 Mar 2026 10:00:00 +0000</pubDate>
    <category><![CDATA[Offre d'emploi]]></category>
  </item>
</channel>
</rss>`;

describe("parseBetonBarretteFeed", () => {
  it("nettoie le préfixe et extrait titre, url, date et catégories", () => {
    const jobs = parseBetonBarretteFeed(FIXTURE, "betonbarrette-qc-ca", "Béton Barrette inc.");
    assert.equal(jobs.length, 2);

    const first = jobs[0]!;
    assert.equal(first.title, "MÉCANICIEN DE CONCASSEUR");
    assert.equal(first.url, "https://betonbarrette.qc.ca/offre-demploi-mecanicien-de-concasseur/");
    assert.equal(first.company, "Béton Barrette inc.");
    assert.equal(first.postedAt, "2026-03-23T14:40:07.000Z");
    assert.deepEqual(first.tags, ["Mécanique"]);

    const second = jobs[1]!;
    assert.equal(second.title, "Opérateur de pelle");
    assert.equal(second.url, "https://betonbarrette.qc.ca/offre-demploi-operateur-de-pelle/");
    assert.deepEqual(second.tags, []);
  });

  it("renvoie un tableau vide pour un flux sans items", () => {
    assert.deepEqual(parseBetonBarretteFeed("<rss></rss>", "betonbarrette-qc-ca", "Béton Barrette inc."), []);
  });
});
