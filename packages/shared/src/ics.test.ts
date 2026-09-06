import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calendarOpenHref,
  escapeIcsText,
  foldIcsLine,
  googleCalendarUrl,
  icsCalendar,
  icsDate,
  nextIcsDate,
  reminderCalendarEvent,
} from "./ics.js";

describe("icsDate / nextIcsDate", () => {
  it("formate YYYYMMDD et le lendemain", () => {
    assert.equal(icsDate("2026-09-06"), "20260906");
    assert.equal(nextIcsDate("2026-09-06"), "20260907");
    assert.equal(nextIcsDate("2026-12-31"), "20270101");
    assert.equal(icsDate("pas-une-date"), null);
  });
});

describe("escapeIcsText + foldIcsLine", () => {
  it("échappe les caractères réservés", () => {
    assert.equal(escapeIcsText("a;b,c\nd\\e"), "a\\;b\\,c\\nd\\\\e");
  });

  it("replie une longue ligne", () => {
    const long = "SUMMARY:" + "é".repeat(80);
    const folded = foldIcsLine(long);
    assert.match(folded, /\r\n /);
    assert.ok(folded.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75));
  });
});

describe("reminderCalendarEvent + icsCalendar", () => {
  const ev = reminderCalendarEvent({
    jobId: "abc",
    title: "Électricien",
    company: "Pomerleau",
    statusLabel: "Entrevue",
    note: "Relancer RH",
    remindAt: "2026-09-10",
    url: "https://jobccqc.ca/emplois/abc/",
  });

  it("construit un événement journée entière", () => {
    assert.ok(ev);
    assert.equal(ev!.uid, "jobccq-candidature-abc@jobccqc.ca");
    assert.match(ev!.title, /Électricien/);
    assert.match(ev!.description ?? "", /Pomerleau/);
  });

  it("refuse une date invalide", () => {
    assert.equal(reminderCalendarEvent({ jobId: "x", title: "A", remindAt: "" }), null);
  });

  it("sérialise un .ics valide", () => {
    const ics = icsCalendar([ev!], new Date("2026-09-06T12:00:00.000Z"));
    assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
    assert.match(ics, /DTSTART;VALUE=DATE:20260910/);
    assert.match(ics, /DTEND;VALUE=DATE:20260911/);
    assert.match(ics, /BEGIN:VALARM/);
    assert.match(ics, /TRIGGER:PT9H/);
    assert.match(ics, /END:VCALENDAR\r\n$/);
  });
});

describe("googleCalendarUrl", () => {
  it("pointe vers le template Google", () => {
    const ev = reminderCalendarEvent({
      jobId: "z",
      title: "Plombier",
      remindAt: "2026-09-08",
      url: "https://jobccqc.ca/emplois/z/",
    });
    const href = googleCalendarUrl(ev!);
    assert.ok(href?.startsWith("https://calendar.google.com/calendar/render?"));
    assert.match(href!, /dates=20260908%2F20260909/);
  });
});

describe("calendarOpenHref", () => {
  const ev = reminderCalendarEvent({
    jobId: "z",
    title: "Plombier",
    remindAt: "2026-09-08",
  })!;
  const icsHref = "data:text/calendar;charset=utf-8,BEGIN";

  it("Android ouvre Google Agenda au lieu du .ics", () => {
    const href = calendarOpenHref(
      ev,
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36",
      icsHref,
    );
    assert.ok(href.startsWith("https://calendar.google.com/calendar/render?"));
  });

  it("iPhone garde le .ics", () => {
    const href = calendarOpenHref(
      ev,
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      icsHref,
    );
    assert.equal(href, icsHref);
  });
});
