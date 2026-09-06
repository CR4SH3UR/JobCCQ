import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseNtfyTarget } from "./ntfy.js";

describe("parseNtfyTarget", () => {
  it("accepte un nom de topic", () => {
    const t = parseNtfyTarget("jobccq-alertes", "https://ntfy.sh");
    assert.deepEqual(t, { server: "https://ntfy.sh", topic: "jobccq-alertes" });
  });

  it("accepte une URL https", () => {
    const t = parseNtfyTarget("https://ntfy.example.com/mon-topic/");
    assert.deepEqual(t, { server: "https://ntfy.example.com", topic: "mon-topic" });
  });

  it("refuse un topic vide ou bizarre", () => {
    assert.equal(parseNtfyTarget(""), null);
    assert.equal(parseNtfyTarget("https://ntfy.sh/"), null);
    assert.equal(parseNtfyTarget("a b"), null);
  });
});
