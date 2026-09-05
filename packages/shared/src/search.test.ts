import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyQuery } from "./filters.js";
import { expandTerm } from "./synonyms.js";
import { boundedLevenshtein, fuzzyIncludes, normalizeText } from "./text.js";
import { suggest } from "./suggest.js";
import type { Job, JobQuery } from "./types.js";

const queryFor = (q: string): JobQuery =>
  ({ q, sort: "relevance", page: 1, pageSize: 50 }) as JobQuery;

let seq = 0;
function job(title: string, extra: Partial<Job> = {}): Job {
  seq += 1;
  return {
    id: `j${seq}`,
    sourceId: "src",
    url: `https://example.com/${seq}`,
    title,
    company: extra.company ?? "Entreprise X",
    tags: [],
    languages: [],
    scrapedAt: new Date().toISOString(),
    ...extra,
  } as Job;
}

const titlesFor = (jobs: Job[], q: string) =>
  applyQuery(jobs, queryFor(q)).items.map((j) => j.title);

describe("recherche — synonymes de métiers", () => {
  const jobs = [
    job("Menuisier d'atelier"),
    job("Électricien de chantier"),
    job("Adjointe administrative"),
  ];

  it("« charpentier » trouve une offre « Menuisier »", () => {
    const t = titlesFor(jobs, "charpentier");
    assert.ok(t.includes("Menuisier d'atelier"));
    assert.ok(!t.includes("Adjointe administrative"));
  });

  it("expandTerm relie les termes équivalents", () => {
    assert.ok(expandTerm("charpentier").includes("menuisier"));
    assert.ok(expandTerm("soudeur").includes("welder"));
    assert.deepEqual(expandTerm("motinconnu"), ["motinconnu"]); // pas de synonyme
  });
});

describe("recherche — tolérance aux fautes de frappe", () => {
  const jobs = [job("Charpentier-menuisier"), job("Estimateur en construction")];

  it("« charpentié » trouve « Charpentier-menuisier »", () => {
    assert.ok(titlesFor(jobs, "charpentié").includes("Charpentier-menuisier"));
  });

  it("« estimateurr » (lettre en trop) trouve « Estimateur… »", () => {
    assert.ok(titlesFor(jobs, "estimateurr").includes("Estimateur en construction"));
  });

  it("un mot court trop différent ne matche pas", () => {
    assert.equal(titlesFor(jobs, "xyz").length, 0);
  });
});

describe("text — boundedLevenshtein & fuzzyIncludes", () => {
  it("distance d'édition bornée", () => {
    assert.equal(boundedLevenshtein("charpentier", "charpentier", 2), 0);
    assert.equal(boundedLevenshtein("charpentie", "charpentier", 2), 1);
    assert.equal(boundedLevenshtein("abc", "xyz", 2), 3); // > max → max + 1
  });

  it("fuzzyIncludes tolère une faute sur un mot long", () => {
    const hay = normalizeText("Contremaître de chantier");
    assert.ok(fuzzyIncludes(hay, normalizeText("contremaitre")));
    assert.ok(fuzzyIncludes(hay, normalizeText("contremaître")));
    assert.ok(!fuzzyIncludes(hay, normalizeText("plombier")));
  });
});

describe("suggest — classement des suggestions", () => {
  const entries = [
    { value: "Charpentier-menuisier", kind: "metier" as const },
    { value: "Chargé de projet", kind: "metier" as const },
    { value: "Construction Demathieu", kind: "entreprise" as const },
    { value: "Charny", kind: "ville" as const },
  ];

  it("préfixe classé avant sous-chaîne", () => {
    const s = suggest("char", entries);
    assert.ok(s.length >= 2);
    // « Charpentier… », « Chargé… », « Charny » commencent par « char ».
    assert.ok(s[0]!.label.toLowerCase().startsWith("char"));
    assert.ok(s.every((x) => x.score > 0));
  });

  it("rien en dessous de 2 caractères", () => {
    assert.deepEqual(suggest("c", entries), []);
  });

  it("tolère une faute de frappe", () => {
    const s = suggest("charpentié", entries);
    assert.ok(s.some((x) => x.value === "Charpentier-menuisier"));
  });
});
