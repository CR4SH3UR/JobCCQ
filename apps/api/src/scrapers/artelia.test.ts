import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ScrapeContext } from "./types.js";
import { arteliaScraper } from "./artelia.js";

function tile(href: string, title: string): string {
  return `<a class="attrax-vacancy-tile__title" href="${href}">${title}</a>
    <a href="${href}">En savoir plus</a>`;
}

describe("arteliaScraper.parseList", () => {
  it("déduplique titre + « En savoir plus » et lit la ville dans le slug", () => {
    const html = tile(
      "/canada-fr/job/assistant-charge-de-projet-cpi-in-laval-jid-4091",
      "Assistant chargé de projet (CPI)",
    );
    const jobs = arteliaScraper.parseList!(html, "https://careers.arteliagroup.com/canada-fr/jobs");
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]!.title, "Assistant chargé de projet (CPI)");
    assert.equal(jobs[0]!.location, "Laval");
    assert.match(jobs[0]!.url, /jid-4091$/);
  });

  it("prend le dernier « -in- » avant le jid (titres fly-in-fly-out)", () => {
    const html = tile(
      "/canada-fr/job/technicien-ne-en-arpentage-fly-in-fly-out-fifo-in-montreal-jid-3242",
      "Technicien·ne en arpentage",
    );
    const jobs = arteliaScraper.parseList!(html, "https://careers.arteliagroup.com/");
    assert.equal(jobs[0]!.location, "Montreal");
  });
});

describe("arteliaScraper.scrape", () => {
  it("parcourt toutes les pages Attrax (max 48/page), pas une seule page size=480", async () => {
    const fetched: string[] = [];
    const pageJobs = (from: number, n: number) =>
      Array.from({ length: n }, (_, i) => {
        const id = from + i;
        return tile(`/canada-fr/job/poste-${id}-in-montreal-jid-${id}`, `Poste ${id}`);
      }).join("\n");

    const ctx: ScrapeContext = {
      log() {},
      async fetchHtml(url: string) {
        fetched.push(url);
        const page = Number(new URL(url).searchParams.get("page") ?? "0");
        const size = Number(new URL(url).searchParams.get("size") ?? "0");
        assert.equal(size, 48, `Attrax plafonne à 48, reçu size=${size} pour ${url}`);
        if (page === 1) return `${pageJobs(1, 48)}<span>107 résultat(s)</span>`;
        if (page === 2) return pageJobs(49, 48);
        if (page === 3) return pageJobs(97, 11);
        return "<span>107 résultat(s)</span>";
      },
    };

    const jobs = await arteliaScraper.scrape({}, ctx);
    assert.equal(jobs.length, 107);
    assert.ok(fetched.some((u) => u.includes("page=2")));
    assert.ok(fetched.some((u) => u.includes("page=3")));
    assert.ok(fetched.every((u) => !u.includes("size=480")));
  });
});
