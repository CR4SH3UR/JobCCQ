import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { careersMethodForUrl, careersMethodLabel } from "./careers-via.js";

const emp = {
  careersUrl: "https://www.jobillico.com/fr/employeurs/caf/voir-liste-emplois",
  method: "jobillico",
  careersUrl2: "https://excavationcaf.ca/#carrieres",
  method2: "html",
};

describe("careersMethodForUrl", () => {
  it("reconnaît Jobillico par l'hôte de l'offre", () => {
    assert.equal(
      careersMethodForUrl("https://www.jobillico.com/fr/offre-d-emploi/x/1", emp),
      "jobillico",
    );
  });

  it("attribue le 2e lien quand l'hôte de l'offre correspond", () => {
    assert.equal(
      careersMethodForUrl("https://excavationcaf.ca/emploi/soudeur", emp),
      "html",
    );
  });

  it("lit le tag via: si l'URL n'est pas un portail connu", () => {
    assert.equal(
      careersMethodForUrl("https://cdn.example/job/1", emp, ["via:html"]),
      "html",
    );
  });
});

describe("careersMethodLabel", () => {
  it("libellé court pour l'admin", () => {
    assert.equal(careersMethodLabel("jobillico"), "Jobillico");
    assert.equal(careersMethodLabel("html"), "Site");
  });
});
