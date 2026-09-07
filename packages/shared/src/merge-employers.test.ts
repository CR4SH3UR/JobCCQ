import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyMergePlan, mergeEmployerFields, pickKeepEmployerId, suggestMergePlan } from "./merge-employers.js";

const a = {
  id: "acme-com",
  name: "Acme",
  homepage: "https://acme.com",
  careersUrl: "https://acme.com/jobs",
  method: "html",
  verified: false,
};
const b = {
  id: "acme-inc",
  name: "Acme Inc",
  homepage: "",
  careersUrl: "https://acme.com/jobs",
  method: "jobillico",
  rbq: "1234-5678",
  verified: true,
  sectors: ["Génie civil"],
};

describe("pickKeepEmployerId", () => {
  it("préfère le vérifié, puis le plus d'offres", () => {
    assert.equal(pickKeepEmployerId(a, b), b.id);
    assert.equal(pickKeepEmployerId(a, { ...b, verified: false }, { a: 10, b: 1 }), a.id);
  });

  it("préfère le scraper sur mesure même non vérifié", () => {
    assert.equal(
      pickKeepEmployerId({ ...b, id: "canam", verified: false }, { ...a, verified: true }),
      "canam",
    );
  });
});

describe("mergeEmployerFields", () => {
  it("garde l'id keep et complète rbq / secteurs / note", () => {
    const m = mergeEmployerFields(a, b);
    assert.equal(m.id, "acme-com");
    assert.equal(m.method, "html");
    assert.equal(m.rbq, "1234-5678");
    assert.equal(m.verified, true);
    assert.ok(m.sectors?.includes("Génie civil"));
    assert.match(m.notes ?? "", /acme-inc/);
  });

  it("absorbe l'URL du drop comme 2e carrière si elle diffère", () => {
    const drop = { ...b, careersUrl: "https://www.jobillico.com/fr/voir-entreprise/Acme/1/", method: "jobillico" };
    const m = mergeEmployerFields(a, drop);
    assert.equal(m.careersUrl, "https://acme.com/jobs");
    assert.equal(m.careersUrl2, drop.careersUrl);
    assert.equal(m.method2, "jobillico");
  });
});

describe("suggestMergePlan / applyMergePlan", () => {
  it("propose le vérifié comme id à garder et complète les vides", () => {
    const plan = suggestMergePlan(a, b);
    assert.equal(plan.keepId, b.id);
    assert.equal(plan.fields.sectors, "both");
    assert.equal(plan.fields.notes, "both");
  });

  it("garde l'id choisi et le nom / l'URL du côté demandé", () => {
    const plan = suggestMergePlan(a, b);
    plan.keepId = a.id;
    plan.fields.name = "b";
    plan.fields.careersUrl = "a";
    plan.fields.rbq = "b";
    const m = applyMergePlan(a, b, plan);
    assert.equal(m.id, "acme-com");
    assert.equal(m.name, "Acme Inc");
    assert.equal(m.careersUrl, "https://acme.com/jobs");
    assert.equal(m.method, "html");
    assert.equal(m.rbq, "1234-5678");
  });

  it("peut prendre l'URL et la méthode de B tout en gardant l'id de A", () => {
    const plan = suggestMergePlan(a, b);
    plan.keepId = a.id;
    plan.fields.careersUrl = "b";
    const m = applyMergePlan(a, b, plan);
    assert.equal(m.id, a.id);
    assert.equal(m.careersUrl, b.careersUrl);
    assert.equal(m.method, "jobillico");
  });
});
