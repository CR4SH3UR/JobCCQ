import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Job } from "./types.js";
import {
  decideProfileSync,
  EMPTY_PROFILE,
  matchJobToProfile,
  mergeProfiles,
  parseProfile,
  profileIsSet,
  rankJobsByProfile,
  type JobSeekerProfile,
} from "./profile-match.js";
import { applyQuery } from "./filters.js";

function job(title: string, extra: Partial<Job> = {}): Job {
  return {
    id: extra.id ?? title,
    sourceId: "src",
    url: "https://example.com/j",
    title,
    company: "Acme",
    tags: [],
    languages: [],
    scrapedAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  } as Job;
}

const electricienMtl: JobSeekerProfile = {
  trades: ["electricien"],
  regions: ["montreal"],
  remote: ["presentiel"],
};

describe("parseProfile", () => {
  it("ignore les ids inconnus et déduplique", () => {
    const p = parseProfile({
      trades: ["electricien", "electricien", "licorne"],
      regions: ["montreal", "mars"],
      remote: ["presentiel", "soucoupe"],
    });
    assert.deepEqual(p.trades, ["electricien"]);
    assert.deepEqual(p.regions, ["montreal"]);
    assert.deepEqual(p.remote, ["presentiel"]);
  });

  it("profileIsSet est faux si tout est vide", () => {
    assert.equal(profileIsSet(parseProfile({})), false);
    assert.equal(profileIsSet(electricienMtl), true);
  });
});

describe("mergeProfiles + decideProfileSync", () => {
  it("fusionne sans doublon", () => {
    const m = mergeProfiles(
      { trades: ["electricien"], regions: ["montreal"], remote: [] },
      { trades: ["electricien", "plombier"], regions: ["laval"], remote: ["presentiel"] },
    );
    assert.deepEqual(m.trades, ["electricien", "plombier"]);
    assert.deepEqual(m.regions, ["montreal", "laval"]);
    assert.deepEqual(m.remote, ["presentiel"]);
  });

  it("pousse le local s'il n'y a rien en remote", () => {
    const d = decideProfileSync({
      local: electricienMtl,
      localAt: 0,
      remote: null,
      remoteAt: 0,
    });
    assert.equal(d.action, "keep-local");
    if (d.action === "keep-local") assert.equal(d.persistRemote, true);
  });

  it("prend le remote si ce navigateur n'a rien", () => {
    const d = decideProfileSync({
      local: EMPTY_PROFILE,
      localAt: 0,
      remote: electricienMtl,
      remoteAt: 10,
    });
    assert.equal(d.action, "use-remote");
  });

  it("la dernière écriture gagne", () => {
    const older = { trades: ["plombier"], regions: [], remote: [] as JobSeekerProfile["remote"] };
    const newer = electricienMtl;
    const localWins = decideProfileSync({
      local: newer,
      localAt: 20,
      remote: older,
      remoteAt: 10,
    });
    assert.equal(localWins.action, "keep-local");
    if (localWins.action === "keep-local") {
      assert.equal(localWins.persistRemote, true);
      assert.deepEqual(localWins.profile.trades, ["electricien"]);
    }
    const remoteWins = decideProfileSync({
      local: older,
      localAt: 10,
      remote: newer,
      remoteAt: 20,
    });
    assert.equal(remoteWins.action, "use-remote");
  });

  it("sans horodatage, fusionne pour ne rien perdre", () => {
    const d = decideProfileSync({
      local: { trades: ["electricien"], regions: [], remote: [] },
      localAt: 0,
      remote: { trades: [], regions: ["montreal"], remote: [] },
      remoteAt: 0,
    });
    assert.equal(d.action, "merge");
    if (d.action === "merge") {
      assert.deepEqual(d.profile.trades, ["electricien"]);
      assert.deepEqual(d.profile.regions, ["montreal"]);
    }
  });
});

describe("matchJobToProfile", () => {
  it("renvoie null sans profil", () => {
    assert.equal(matchJobToProfile(job("Électricien"), parseProfile({})), null);
  });

  it("score 100 si métier, région et mobilité collent", () => {
    const m = matchJobToProfile(
      job("Électricien de chantier", { regionId: "montreal", remote: "presentiel" }),
      electricienMtl,
    );
    assert.equal(m?.score, 100);
    assert.ok(m?.reasons.some((r) => /lectricien/i.test(r)));
  });

  it("ne pénalise pas un axe non renseigné", () => {
    const onlyTrade: JobSeekerProfile = { trades: ["electricien"], regions: [], remote: [] };
    const m = matchJobToProfile(job("Électricien", { regionId: "gaspesie-iles-de-la-madeleine" }), onlyTrade);
    assert.equal(m?.score, 100);
  });

  it("un télétravail matche n'importe laquelle des régions du profil", () => {
    const m = matchJobToProfile(
      job("Électricien", { regionId: "saguenay-lac-saint-jean", remote: "teletravail" }),
      electricienMtl,
    );
    assert.ok((m?.score ?? 0) >= 85);
    assert.ok(m?.reasons.includes("Télétravail"));
  });

  it("un métier différent baisse le score", () => {
    const m = matchJobToProfile(
      job("Plombier", { regionId: "montreal", remote: "presentiel" }),
      electricienMtl,
    );
    assert.equal(m?.score, 50);
  });

  it("une offre hors métiers CCQ n'affiche pas 0 % si seul le métier est au profil", () => {
    const onlyTrade: JobSeekerProfile = { trades: ["electricien"], regions: [], remote: [] };
    assert.equal(matchJobToProfile(job("Préventionniste SSE"), onlyTrade), null);
  });

  it("détecte un contremaître", () => {
    const p: JobSeekerProfile = { trades: ["contremaitre"], regions: [], remote: [] };
    assert.equal(matchJobToProfile(job("CONTREMAITRE"), p)?.score, 100);
  });
});

describe("rankJobsByProfile + filtre trades", () => {
  it("classe le meilleur match en premier", () => {
    const jobs = [
      job("Manœuvre", { id: "a", regionId: "laval" }),
      job("Électricien", { id: "b", regionId: "montreal", remote: "presentiel" }),
    ];
    const ranked = rankJobsByProfile(jobs, electricienMtl);
    assert.equal(ranked[0]?.id, "b");
  });

  it("trades ne garde que les métiers demandés", () => {
    const r = applyQuery(
      [job("Électricien de chantier"), job("Plombier")],
      { trades: ["electricien"], sort: "recent", page: 1, pageSize: 50 },
    );
    assert.deepEqual(r.items.map((j) => j.title), ["Électricien de chantier"]);
  });
});
