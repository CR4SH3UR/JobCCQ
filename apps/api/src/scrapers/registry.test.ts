import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DiscoveredEmployer } from "@jobccq/shared";
import { cafortierScraper } from "./cafortier.js";
import { ebcScraper } from "./ebc.js";
import { extraBespokeFor, primaryScraperFor } from "./registry.js";

const caf: DiscoveredEmployer = {
  id: "charles-auguste-fortier-inc-caf",
  name: "Charles-Auguste Fortier Inc. - CAF",
  homepage: "https://www.jobillico.com/voir-entreprise/charles-auguste-fortier-inc-caf",
  careersUrl: "https://www.jobillico.com/fr/employeurs/charles-auguste-fortier-inc-caf/voir-liste-emplois",
  method: "jobillico",
  careersUrl2: "https://excavationcaf.ca/#carrieres",
  method2: "html",
};

describe("primaryScraperFor", () => {
  it("scrape Jobillico en 1er lien même si un parseur perso existe pour le site", () => {
    const p = primaryScraperFor(caf);
    assert.notEqual(p.parseList, cafortierScraper.parseList);
  });

  it("scrape Jobillico même sans 2e URL", () => {
    const p = primaryScraperFor({
      id: caf.id,
      name: caf.name,
      homepage: caf.homepage,
      careersUrl: caf.careersUrl,
      method: "jobillico",
    });
    assert.notEqual(p.parseList, cafortierScraper.parseList);
  });

  it("garde le parseur perso quand le 1er lien est le site de l'employeur", () => {
    const p = primaryScraperFor({
      id: "ebc",
      name: "EBC",
      homepage: "https://ebcinc.com/fr/carrieres/emplois/",
      careersUrl: "https://ebcinc.com/fr/carrieres/emplois/",
      method: "html",
    });
    assert.equal(p.parseList, ebcScraper.parseList);
  });
});

describe("extraBespokeFor", () => {
  it("branche le parseur CAF sur le 2e lien excavationcaf.ca", () => {
    const extra = extraBespokeFor(caf, [caf]);
    assert.equal(extra?.parseList, cafortierScraper.parseList);
  });
});
