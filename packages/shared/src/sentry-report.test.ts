import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSentryDsn, reportToSentry, sentryStorePayload } from "./sentry-report.js";

describe("sentry-report", () => {
  it("parse un DSN classique", () => {
    const t = parseSentryDsn("https://abc123@o1.ingest.sentry.io/450");
    assert.ok(t);
    assert.equal(t.key, "abc123");
    assert.equal(t.projectId, "450");
    assert.equal(t.storeUrl, "https://o1.ingest.sentry.io/api/450/store/");
  });

  it("ignore un DSN vide", () => {
    assert.equal(parseSentryDsn(""), null);
    assert.equal(parseSentryDsn("  "), null);
  });

  it("ne tente rien sans DSN", async () => {
    assert.equal(await reportToSentry("", new Error("x"), { app: "web" }), false);
  });

  it("fabrique un payload avec le message", () => {
    const p = sentryStorePayload(new Error("boom"), { app: "api" });
    assert.equal((p.tags as { app: string }).app, "api");
    const values = (p.exception as { values: { value: string }[] }).values;
    assert.equal(values[0]?.value, "boom");
  });
});
