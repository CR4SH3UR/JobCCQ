import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Job } from "./types.js";
import type { JobSeekerProfile } from "./profile-match.js";
import {
  featureCosine,
  jobFeatureWeights,
  recommendJobs,
  seedJobIds,
} from "./recommendations.js";

function job(id: string, extra: Partial<Job> = {}): Job {
  return {
    id,
    sourceId: extra.sourceId ?? "src",
    url: `https://example.com/${id}`,
    title: extra.title ?? id,
    company: extra.company ?? "Acme",
    tags: [],
    languages: [],
    scrapedAt: extra.scrapedAt ?? "2026-01-01T00:00:00.000Z",
    ...extra,
  } as Job;
}

describe("seedJobIds", () => {
  it("déduplique et ignore les vides", () => {
    assert.deepEqual(
      seedJobIds({ favoriteIds: ["a", "a", ""], appliedIds: ["b", "a"] }),
      ["a", "b"],
    );
  });
});

describe("featureCosine", () => {
  it("vaut 1 pour deux vecteurs identiques", () => {
    const a = jobFeatureWeights(job("x", { title: "Électricien", regionId: "montreal" }));
    assert.equal(featureCosine(a, new Map(a)), 1);
  });

  it("vaut 0 sans attribut commun", () => {
    const a = jobFeatureWeights(job("x", { title: "Électricien", regionId: "montreal", sourceId: "a" }));
    const b = jobFeatureWeights(job("y", { title: "Plombier", regionId: "laval", sourceId: "b", company: "Autre" }));
    assert.equal(featureCosine(a, b), 0);
  });
});

describe("recommendJobs", () => {
  const catalog = [
    job("fav-elec", {
      title: "Électricien de chantier",
      regionId: "montreal",
      categoryId: "construction",
      sourceId: "pomerleau",
      company: "Pomerleau",
    }),
    job("near-elec", {
      title: "Électricien industriel",
      regionId: "montreal",
      categoryId: "construction",
      sourceId: "ebc",
      company: "EBC",
      postedAt: "2026-06-01T00:00:00.000Z",
    }),
    job("far-plomberie", {
      title: "Plombier",
      regionId: "saguenay-lac-saint-jean",
      categoryId: "construction",
      sourceId: "autre",
      company: "Plomberie Nord",
    }),
    job("same-employer", {
      title: "Charpentier-menuisier",
      regionId: "laval",
      sourceId: "pomerleau",
      company: "Pomerleau",
    }),
  ];

  it("renvoie [] sans signal", () => {
    assert.deepEqual(recommendJobs(catalog, { favoriteIds: [], appliedIds: [] }), []);
  });

  it("renvoie [] si les graines sont hors catalogue", () => {
    assert.deepEqual(recommendJobs(catalog, { favoriteIds: ["inconnu"], appliedIds: [] }), []);
  });

  it("exclut les graines et classe l'offre la plus proche en premier", () => {
    const recs = recommendJobs(catalog, { favoriteIds: ["fav-elec"], appliedIds: [] }, { limit: 10 });
    assert.ok(!recs.some((r) => r.job.id === "fav-elec"));
    assert.equal(recs[0]?.job.id, "near-elec");
    assert.ok(recs[0]!.score > (recs.find((r) => r.job.id === "far-plomberie")?.score ?? 0));
    assert.ok(recs[0]!.reasons.some((x) => /lectricien|Montr/i.test(x)));
  });

  it("une candidature pèse plus qu'un simple favori", () => {
    const fromFav = recommendJobs(catalog, { favoriteIds: ["fav-elec"], appliedIds: [] }).find(
      (r) => r.job.id === "near-elec",
    );
    const fromApp = recommendJobs(catalog, { favoriteIds: [], appliedIds: ["fav-elec"] }).find(
      (r) => r.job.id === "near-elec",
    );
    assert.ok(fromFav && fromApp);
    assert.ok(fromApp.score > fromFav.score);
  });

  it("respecte la limite", () => {
    const recs = recommendJobs(catalog, { favoriteIds: ["fav-elec"], appliedIds: [] }, { limit: 1 });
    assert.equal(recs.length, 1);
  });

  it("un profil compatible peut reclasser", () => {
    const profile: JobSeekerProfile = {
      trades: ["charpentier-menuisier"],
      regions: ["laval"],
      remote: [],
    };
    const recs = recommendJobs(
      catalog,
      { favoriteIds: ["fav-elec"], appliedIds: [] },
      { profile, limit: 10 },
    );
    const sameEmployer = recs.find((r) => r.job.id === "same-employer");
    assert.ok(sameEmployer);
    assert.ok(sameEmployer.score > 0);
  });
});
