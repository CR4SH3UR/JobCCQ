import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isReminderDue, reminderNeedsNotify } from "./reminders.js";

const day = (iso: string) => new Date(`${iso}T12:00:00`);

describe("isReminderDue", () => {
  it("est vrai le jour J et après", () => {
    assert.equal(isReminderDue("2026-09-06", day("2026-09-06")), true);
    assert.equal(isReminderDue("2026-09-05", day("2026-09-06")), true);
    assert.equal(isReminderDue("2026-09-07", day("2026-09-06")), false);
  });

  it("ignore une date vide ou invalide", () => {
    assert.equal(isReminderDue("", day("2026-09-06")), false);
    assert.equal(isReminderDue("bientôt", day("2026-09-06")), false);
    assert.equal(isReminderDue(null, day("2026-09-06")), false);
  });
});

describe("reminderNeedsNotify", () => {
  it("envoie si échu et jamais notifié", () => {
    assert.equal(reminderNeedsNotify("2026-09-06", null, day("2026-09-06")), true);
    assert.equal(reminderNeedsNotify("2026-09-06", "", day("2026-09-06")), true);
  });

  it("n'envoie pas deux fois pour la même date", () => {
    assert.equal(reminderNeedsNotify("2026-09-06", "2026-09-06T13:00:00.000Z", day("2026-09-06")), false);
    assert.equal(reminderNeedsNotify("2026-09-06", "2026-09-06T13:00:00.000Z", day("2026-09-07")), false);
  });

  it("réarme si la date de rappel a avancé", () => {
    assert.equal(reminderNeedsNotify("2026-09-10", "2026-09-06T13:00:00.000Z", day("2026-09-10")), true);
    assert.equal(reminderNeedsNotify("2026-09-10", "2026-09-06T13:00:00.000Z", day("2026-09-08")), false);
  });
});
