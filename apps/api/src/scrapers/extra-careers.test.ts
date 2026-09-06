import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RawJob } from "@jobccq/shared";
import {
  extraCareersAbsorbs,
  extraCareersConfig,
  mergeRawJobsByUrl,
  pickPeerEmployerId,
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
    const merged = mergeRawJobsByUrl(a, b, "jobillico");
    assert.equal(merged.length, 3);
    assert.equal(merged[0]!.title, "Soudeur");
    assert.equal(merged[2]!.sourceId, "acme-ca");
    assert.equal(merged[2]!.url, "https://jobillico.com/x");
    assert.ok(merged[2]!.tags?.includes("via:jobillico"));
  });

  it("réattribue toutes les offres à la fiche scrapée, pas à l'ancien id du parseur", () => {
    const merged = mergeRawJobsByUrl(
      [job("https://jobillico.com/x", "Soudeur", "charles-auguste-fortier-inc-caf")],
      [job("https://excavationcaf.ca/#meca", "Mécanicien", "cafortier-com")],
      "html",
      "charles-auguste-fortier-inc-caf",
    );
    assert.equal(merged.length, 2);
    assert.ok(merged.every((j) => j.sourceId === "charles-auguste-fortier-inc-caf"));
  });

  it("à URL identique, garde la version la plus complète", () => {
    const thin: RawJob = job("https://acme.ca/j/1", "Soudeur");
    const rich: RawJob = {
      ...job("https://acme.ca/j/1", "Soudeur certifié", "other"),
      location: "Québec, QC",
      salaryMin: 28,
      salaryMax: 34,
      salaryPeriod: "heure",
      description: "Poste de soudeur en chantier, quart de jour, avantages sociaux inclus. ".repeat(3),
      employmentType: "temps-plein",
    };
    const merged = mergeRawJobsByUrl([thin], [rich], "html");
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.title, "Soudeur certifié");
    assert.equal(merged[0]!.salaryMin, 28);
    assert.equal(merged[0]!.location, "Québec, QC");
    assert.ok((merged[0]!.description?.length ?? 0) >= 80);
  });

  it("même titre sur 2 sites : une seule offre, celle qui a le plus de champs", () => {
    const site = job("https://excavationcaf.ca/#soudeur", "Soudeur");
    const portal: RawJob = {
      ...job("https://www.jobillico.com/fr/emploi/123", "Soudeur", "other"),
      location: "Québec",
      employmentType: "temps-plein",
      description: "Recherche un soudeur d'expérience pour nos chantiers de la Capitale-Nationale. ".repeat(2),
    };
    const merged = mergeRawJobsByUrl([site], [portal], "jobillico");
    assert.equal(merged.length, 1);
    assert.match(merged[0]!.url, /jobillico/);
    assert.equal(merged[0]!.location, "Québec");
    assert.ok(merged[0]!.tags?.includes("via:jobillico"));
  });

  it("complète les champs vides de l'offre retenue avec l'autre source", () => {
    const withPay: RawJob = {
      ...job("https://acme.ca/j/1", "Coffreur"),
      salaryMin: 32,
      salaryPeriod: "heure",
    };
    const withPlace: RawJob = {
      ...job("https://www.jobillico.com/fr/emploi/9", "Coffreur", "other"),
      location: "Lévis",
      employmentType: "temps-plein",
    };
    const merged = mergeRawJobsByUrl([withPay], [withPlace], "jobillico");
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.salaryMin, 32);
    assert.equal(merged[0]!.location, "Lévis");
    assert.equal(merged[0]!.employmentType, "temps-plein");
  });
});

describe("pickPeerEmployerId", () => {
  const employers = [
    {
      id: "cafortier-com",
      careersUrl: "https://excavationcaf.ca/#carrieres",
      homepage: "https://excavationcaf.ca",
    },
    {
      id: "charles-auguste-fortier-inc-caf",
      careersUrl: "https://www.jobillico.com/fr/employeurs/charles-auguste-fortier-inc-caf/voir-liste-emplois",
      homepage: "https://www.jobillico.com/voir-entreprise/charles-auguste-fortier-inc-caf",
      careersUrl2: "https://excavationcaf.ca/#carrieres",
    },
    {
      id: "other-ca",
      careersUrl: "https://other.ca/jobs",
      homepage: "https://other.ca",
    },
  ];
  const custom = new Set(["charles-auguste-fortier-inc-caf"]);

  it("relie le 2e lien à la fiche qui l'a déclaré, pas à l'ancienne", () => {
    assert.equal(
      pickPeerEmployerId("https://excavationcaf.ca/#carrieres", employers, custom),
      "charles-auguste-fortier-inc-caf",
    );
  });

  it("ignore un hôte sans scraper perso", () => {
    assert.equal(pickPeerEmployerId("https://other.ca/jobs", employers, custom), undefined);
  });
});

describe("extraCareersAbsorbs", () => {
  it("détecte l'ancienne fiche dont le site est déjà le 2e lien d'une autre", () => {
    assert.equal(
      extraCareersAbsorbs(
        { id: "cafortier-com", careersUrl: "https://excavationcaf.ca/#carrieres" },
        [
          {
            id: "charles-auguste-fortier-inc-caf",
            careersUrl2: "https://excavationcaf.ca/#carrieres",
          },
        ],
      ),
      true,
    );
  });
});

describe("withExtraCareersScraper", () => {
  it("enchaîne le scrape principal et le 2e lien", async () => {
    const primary: Scraper = {
      id: "cafortier-com",
      scrape: async () => [job("https://acme.ca/j/1", "Soudeur", "cafortier-com")],
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
    assert.equal(wrapped.id, "acme-ca");
    assert.equal(out.length, 2);
    assert.equal(out[0]!.sourceId, "acme-ca");
    assert.equal(out[1]!.title, "Coffreur");
    assert.equal(out[1]!.sourceId, "acme-ca");
    assert.match(logs.join("\n"), /2e carrière/);
  });
});
