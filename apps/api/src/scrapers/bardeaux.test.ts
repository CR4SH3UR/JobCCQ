import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBardeaux } from "./bardeaux.js";

describe("parseBardeaux", () => {
  it("émet le poste unique « Couvreur » depuis le H1", () => {
    const jobs = parseBardeaux(
      "<h1>emploi couvreur</h1><p>Rejoins notre équipe de couvreur.</p>",
      "https://bardeaux.ca/emploi-couvreur/",
    );
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]!.title, "Couvreur");
    assert.equal(jobs[0]!.location, "Trois-Rivières, QC");
    assert.equal(jobs[0]!.employmentType, "temps-plein");
  });

  it("ne renvoie rien si la page ne mentionne plus le poste", () => {
    const jobs = parseBardeaux("<h1>Merci</h1><p>Aucun poste ouvert pour le moment.</p>");
    assert.equal(jobs.length, 0);
  });
});
