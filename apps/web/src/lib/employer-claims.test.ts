import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withLookupEmails, type EmployerClaim } from "./employer-claims.js";

const claim = (over: Partial<EmployerClaim> = {}): EmployerClaim => ({
  userId: "u1",
  employerId: "hamel-construction",
  status: "approved",
  note: "",
  email: "",
  createdAt: "2026-09-06T00:00:00.000Z",
  ...over,
});

describe("employer-claims", () => {
  it("préfère le courriel de l'annuaire admin", () => {
    const emails = new Map([["u1", "marie@hamel.ca"]]);
    const [got] = withLookupEmails([claim({ email: "old@x.ca" })], emails);
    assert.equal(got.email, "marie@hamel.ca");
  });

  it("garde le courriel déjà stocké si l'annuaire n'a pas l'id", () => {
    const [got] = withLookupEmails([claim({ email: "deja@hamel.ca" })], new Map());
    assert.equal(got.email, "deja@hamel.ca");
  });
});
