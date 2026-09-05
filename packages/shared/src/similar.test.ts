import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { similarEmployers } from "./filters.js";
import type { HiringCompany } from "./types.js";

const co = (partial: Partial<HiringCompany> & Pick<HiringCompany, "company" | "sources">): HiringCompany => ({
  openings: 1,
  categories: [],
  regions: [],
  ...partial,
});

describe("similarEmployers", () => {
  const current = co({
    company: "Alpha",
    sources: ["alpha"],
    regions: ["montreal"],
    categories: ["construction"],
    openings: 4,
  });
  const peers = [
    current,
    co({
      company: "Beta",
      sources: ["beta"],
      regions: ["montreal"],
      categories: ["construction"],
      openings: 3,
    }),
    co({
      company: "Gamma",
      sources: ["gamma"],
      regions: ["capitale-nationale"],
      categories: ["ingenierie"],
      openings: 10,
    }),
    co({
      company: "Delta",
      sources: ["delta"],
      regions: ["montreal"],
      categories: ["ingenierie"],
      openings: 2,
    }),
  ];

  it("exclut l'employeur courant et les sans recoupement", () => {
    const got = similarEmployers(current, peers);
    assert.deepEqual(
      got.map((c) => c.company),
      ["Beta", "Delta"],
    );
  });

  it("préfère même région + même domaine", () => {
    const got = similarEmployers(current, peers, 1);
    assert.equal(got[0]?.company, "Beta");
  });
});
