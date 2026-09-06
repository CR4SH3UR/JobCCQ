import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { icsDataUri } from "./format.js";

describe("icsDataUri", () => {
  it("pointe vers text/calendar sans forcer un fichier", () => {
    const ics = "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n";
    const href = icsDataUri(ics);
    assert.ok(href.startsWith("data:text/calendar;charset=utf-8,"));
    assert.equal(decodeURIComponent(href.slice("data:text/calendar;charset=utf-8,".length)), ics);
  });
});
