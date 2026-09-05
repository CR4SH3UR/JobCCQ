import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractContacts } from "./extract.js";

describe("extractContacts", () => {
  it("trouve courriel et téléphone publics", () => {
    const text = "Postulez à rh@acme-construction.ca ou au 514-555-1234.";
    const c = extractContacts(text);
    assert.deepEqual(c.emails, ["rh@acme-construction.ca"]);
    assert.deepEqual(c.phones, ["514-555-1234"]);
  });

  it("ignore les adresses factices", () => {
    const c = extractContacts("Contact placeholder@example.com");
    assert.deepEqual(c.emails, []);
  });
});
