import { test, describe } from "node:test";
import assert from "node:assert";
import * as Sentry from "@sentry/node";

describe("Sentry integration", () => {
  test("Sentry module is available", () => {
    assert.ok(Sentry);
    assert.ok(typeof Sentry.init === "function");
    assert.ok(typeof Sentry.captureException === "function");
  });

  test("Sentry DSN configuration environment variable exists", () => {
    const dsnEnv = process.env.SENTRY_DSN;
    // DSN might not be set in test environment
    if (dsnEnv) {
      assert.ok(dsnEnv.includes("sentry.io"));
    }
  });
});
