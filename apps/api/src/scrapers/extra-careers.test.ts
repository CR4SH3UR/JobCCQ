import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RawJob } from "@jobccq/shared";
import {
  extraCareersConfig,
  mergeRawJobsByUrl,
  withExtraCareersScraper,
} from "./extra-careers.js";
import type { Scraper } from "./types.js";

const job = (url: string, title: string, sourceId = "acme-ca"): RawJob => ({
  sourceId,
  url,
  title,
  company: "Acme",
});

describe("extraCareersConfig", () => {
  it("ignore l'absence de 2e URL", () => {
    assert.equal(extraCareersConfig({ careersUrl: "https://acme.ca/jobs" }), undefined);
  });

  it("ignore une 2e URL identique à la première", () => {
    assert.equal(
      extraCareersConfig({
        careersUrl: "https://acme.ca/jobs/",
        careersUrl2: "https://acme.ca/jobs",
      }),
      undefined,
    );
  });

  it("déduit jobillico depuis l'URL", () => {
    const c = extraCareersConfig({
      careersUrl: "https://acme.ca/carrieres",
      careersUrl2: "https://www.jobillico.com/fr/voir-entreprise/Acme/1/",
    });
    assert.equal(c?.method, "jobillico");
    assert.match(c?.careersUrl ?? "", /jobillico/);
  });

  it("respecte method2 si fournie", () => {
    const c = extraCareersConfig({
      careersUrl: "https://acme.ca/jobs",
      careersUrl2: "https://acme.teamtailor.com",
      method2: "teamtailor",
    });
    assert.equal(c?.method, "teamtailor");
  });
});

describe("mergeRawJobsByUrl", () => {
  it("garde les offres du 1er lien et ajoute celles du 2e sans doublon d'URL", () => {
    const a = [job("https://acme.ca/j/1", "Soudeur"), job("https://acme.ca/j/2", "Manœuvre")];
    const b = [
      job("https://jobillico.com/x", "Soudeur Jobillico", "other"),
      job("https://acme.ca/j/1", "Soudeur (dup)", "other"),
    ];
    const merged = mergeRawJobsByUrl(a, b);
    assert.equal(merged.length, 3);
    assert.equal(merged[0]!.title, "Soudeur");
    assert.equal(merged[2]!.sourceId, "acme-ca");
    assert.equal(merged[2]!.url, "https://jobillico.com/x");
  });
});

describe("withExtraCareersScraper", () => {
  it("enchaîne le scrape principal et le 2e lien", async () => {
    const primary: Scraper = {
      id: "acme-ca",
      scrape: async () => [job("https://acme.ca/j/1", "Soudeur")],
    };
    const wrapped = withExtraCareersScraper(
      {
        id: "acme-ca",
        name: "Acme",
        homepage: "https://acme.ca",
        careersUrl: "https://acme.ca/jobs",
        method: "html",
        careersUrl2: "https://www.jobillico.com/fr/voir-entreprise/Acme/1/",
        method2: "html",
      },
      primary,
      {
        id: "acme-ca",
        scrape: async () => [job("https://jobillico.com/x", "Coffreur", "tmp")],
      },
    );
    const logs: string[] = [];
    const out = await wrapped.scrape(
      {},
      { fetchHtml: async () => "", log: (m) => logs.push(m) },
    );
    assert.equal(out.length, 2);
    assert.equal(out[1]!.title, "Coffreur");
    assert.equal(out[1]!.sourceId, "acme-ca");
    assert.match(logs.join("\n"), /2e carrière/);
  });
});
