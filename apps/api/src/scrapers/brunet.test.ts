import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBrunetFeed } from "./brunet.js";

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:job_listing="https://brunet.cc">
<channel>
  <item>
    <title>Journalier de production</title>
    <link>https://brunet.cc/poste/journalier-ere-de-production-quart-de-soir-4/</link>
    <pubDate>Fri, 04 Sep 2026 16:56:08 +0000</pubDate>
    <job_listing:location><![CDATA[2145, Rang de la Rivière Sud, Sainte-Élisabeth]]></job_listing:location>
    <job_listing:job_type><![CDATA[Jour, Temps plein]]></job_listing:job_type>
    <content:encoded><![CDATA[<p>Horaire : selon le secteur</p><p><strong>Salaire :</strong> 20,00 $/heure</p>]]></content:encoded>
  </item>
  <item>
    <title>Installateur de signalisation routière – Nuit</title>
    <link>https://brunet.cc/poste/installateur-trice-de-signalisation-routiere-nuit-2/</link>
    <pubDate>Fri, 04 Sep 2026 16:35:37 +0000</pubDate>
    <job_listing:location><![CDATA[Québec]]></job_listing:location>
    <job_listing:job_type><![CDATA[Nuit, Temps plein]]></job_listing:job_type>
  </item>
</channel>
</rss>`;

describe("parseBrunetFeed", () => {
  it("extrait titre, url, lieu, type et date", () => {
    const jobs = parseBrunetFeed(FIXTURE, "brunet-cc", "Groupe Brunet");
    assert.equal(jobs.length, 2);

    const first = jobs[0]!;
    assert.equal(first.title, "Journalier de production");
    assert.equal(first.url, "https://brunet.cc/poste/journalier-ere-de-production-quart-de-soir-4/");
    assert.equal(first.location, "2145, Rang de la Rivière Sud, Sainte-Élisabeth");
    assert.equal(first.employmentType, "temps-plein");
    assert.equal(first.postedAt, "2026-09-04T16:56:08.000Z");
    assert.deepEqual(first.tags, ["Jour"]);

    const second = jobs[1]!;
    assert.equal(second.title, "Installateur de signalisation routière – Nuit");
    assert.equal(second.location, "Québec");
    assert.deepEqual(second.tags, ["Nuit"]);
  });

  it("renvoie un tableau vide pour un flux sans items", () => {
    assert.deepEqual(parseBrunetFeed("<rss></rss>", "brunet-cc", "Groupe Brunet"), []);
  });
});
