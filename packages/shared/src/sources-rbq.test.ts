import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRbqLicence, rbqLicenceUrl } from "./sources.js";

describe("formatRbqLicence", () => {
  it("met en forme 10 chiffres", () => {
    assert.equal(formatRbqLicence("5714264801"), "5714-2648-01");
    assert.equal(formatRbqLicence("5714-2648-01"), "5714-2648-01");
    assert.equal(formatRbqLicence(" 5714 2648 01 "), "5714-2648-01");
  });
});

describe("rbqLicenceUrl", () => {
  it("pointe vers la fiche du registre officiel, pas l'ancienne page 404", () => {
    const url = rbqLicenceUrl("5714-2648-01");
    assert.match(url, /^https:\/\/www\.pes\.rbq\.gouv\.qc\.ca\/RegistreLicences\/FicheDetenteur\/5714-2648-01$/);
    assert.doesNotMatch(url, /entreprises-et-licences\/rechercher-une-licence/);
  });

  it("envoie au registre si le numéro est inutilisable", () => {
    assert.equal(rbqLicenceUrl("abc"), "https://www.pes.rbq.gouv.qc.ca/RegistreLicences");
  });
});
