import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretLinkCheck } from "./link-status.js";

describe("interpretLinkCheck", () => {
  it("404/410 et redirection → gone", () => {
    assert.equal(interpretLinkCheck({ status: 404 }), "gone");
    assert.equal(interpretLinkCheck({ status: 410 }), "gone");
    assert.equal(interpretLinkCheck({ status: 301 }), "gone");
    assert.equal(interpretLinkCheck({ status: 302 }), "gone");
  });

  it("2xx → ok", () => {
    assert.equal(interpretLinkCheck({ status: 200 }), "ok");
    assert.equal(interpretLinkCheck({ status: 204 }), "ok");
  });

  it("blocage / erreur → unknown", () => {
    assert.equal(interpretLinkCheck({ status: 403 }), "unknown");
    assert.equal(interpretLinkCheck({ status: 0 }), "unknown");
    assert.equal(interpretLinkCheck({ status: 500 }), "unknown");
  });
});
