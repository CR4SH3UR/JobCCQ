import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PINNED_MAX,
  activePinnedJobIds,
  isPinnedActive,
  mergeSponsorPublish,
  parseFeaturedList,
  parsePinnedList,
  parseSponsorTier,
  pinJobsFirst,
  readSponsorSnapshot,
} from "./sponsors-parse.js";

describe("parsePinnedList", () => {
  it("accepte ids nus et objets", () => {
    const pins = parsePinnedList(["abc", { jobId: "def", until: "2026-09-20" }, { jobId: "abc" }]);
    assert.deepEqual(pins, [
      { jobId: "abc" },
      { jobId: "def", until: "2026-09-20" },
    ]);
  });

  it("ignore le vide et les dates invalides", () => {
    const pins = parsePinnedList([{ jobId: " x ", until: "pas-une-date" }, "", null]);
    assert.deepEqual(pins, [{ jobId: "x" }]);
  });
});

describe("isPinnedActive + activePinnedJobIds", () => {
  const now = new Date("2026-09-06T15:00:00");

  it("sans until : toujours actif", () => {
    assert.equal(isPinnedActive({ jobId: "a" }, now), true);
  });

  it("until inclusif, puis expiré", () => {
    assert.equal(isPinnedActive({ jobId: "a", until: "2026-09-06" }, now), true);
    assert.equal(isPinnedActive({ jobId: "a", until: "2026-09-05" }, now), false);
  });

  it("plafonne et saute les expirés", () => {
    const ids = activePinnedJobIds(
      [
        { jobId: "old", until: "2026-09-01" },
        { jobId: "one", until: "2026-09-10" },
        { jobId: "two" },
        { jobId: "three" },
      ],
      now,
    );
    assert.deepEqual(ids, ["one", "two"]);
    assert.equal(ids.length, PINNED_MAX);
  });
});

describe("pinJobsFirst", () => {
  const jobs = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("remonte dans l'ordre des ids, sans doublon", () => {
    assert.deepEqual(
      pinJobsFirst(jobs, ["c", "a", "c"]).map((j) => j.id),
      ["c", "a", "b"],
    );
  });

  it("ignore un id absent", () => {
    assert.deepEqual(
      pinJobsFirst(jobs, ["z", "b"]).map((j) => j.id),
      ["b", "a", "c"],
    );
  });
});

describe("parseSponsorTier", () => {
  it("normalise or / bronze / argent", () => {
    assert.equal(parseSponsorTier("or"), "or");
    assert.equal(parseSponsorTier("bronze"), "bronze");
    assert.equal(parseSponsorTier("argent"), "argent");
    assert.equal(parseSponsorTier("platine"), "argent");
  });
});

describe("mergeSponsorPublish", () => {
  const remote = readSponsorSnapshot({
    contactEmail: "a@x.ca",
    sponsors: [{ id: "s1", name: "EBC", tagline: "", url: "https://ebc.com" }],
    featured: ["hamel-construction"],
    pinned: [{ jobId: "job-1" }],
  });
  const empty = readSponsorSnapshot({ contactEmail: "", sponsors: [], featured: [], pinned: [] });

  it("si le formulaire n'est pas chargé : ne vide pas les listes distantes", () => {
    const local = readSponsorSnapshot({
      contactEmail: "b@x.ca",
      sponsors: [],
      featured: ["pomerleau"],
      pinned: [],
    });
    const merged = mergeSponsorPublish(remote, local, false);
    assert.equal(merged.contactEmail, "b@x.ca");
    assert.equal(merged.featured[0], "pomerleau");
    assert.equal((merged.sponsors[0] as { name?: string }).name, "EBC");
    assert.equal(merged.pinned[0]?.jobId, "job-1");
  });

  it("si chargé : le formulaire gagne, même vide", () => {
    const merged = mergeSponsorPublish(remote, empty, true);
    assert.deepEqual(merged.featured, []);
    assert.deepEqual(merged.sponsors, []);
  });
});

describe("parseFeaturedList", () => {
  it("déduplique", () => {
    assert.deepEqual(parseFeaturedList([" a ", "a", "", "b"]), ["a", "b"]);
  });
});
