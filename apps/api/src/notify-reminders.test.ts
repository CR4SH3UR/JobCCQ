import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectAlertChannels,
  formatReminderEmailSubject,
  formatReminderNtfy,
  formatReminderPush,
  labelForReminderStatus,
  type DueApplicationReminder,
} from "./notify-reminders.js";

const one: DueApplicationReminder = {
  jobId: "j1",
  title: "Électricien",
  company: "Pomerleau",
  status: "Entrevue",
  note: "Relancer RH",
  remindAt: "2026-09-06",
  url: "https://example.com/emplois/j1/",
};

describe("formatReminder*", () => {
  it("sujet au singulier / pluriel", () => {
    assert.match(formatReminderEmailSubject([one]), /Rappel : Électricien/);
    assert.match(formatReminderEmailSubject([one, { ...one, jobId: "j2" }]), /2 rappels/);
  });

  it("ntfy liste les titres", () => {
    const { title, body } = formatReminderNtfy([one]);
    assert.match(title, /Électricien/);
    assert.match(body, /Pomerleau/);
    assert.match(body, /Entrevue/);
  });

  it("push résume en une ligne", () => {
    const p = formatReminderPush([one]);
    assert.match(p.title, /Rappel/);
    assert.match(p.body, /Électricien/);
    assert.equal(p.jobId, "j1");
  });
});

describe("collectAlertChannels", () => {
  it("déduplique ntfy et webhooks", () => {
    const c = collectAlertChannels([
      { ntfyTopic: "jobccq-moi", webhookUrl: "https://hooks.example/a" },
      { ntfyTopic: "jobccq-moi", webhookUrl: "https://hooks.example/b" },
      { ntfyTopic: "  ", webhookUrl: undefined },
      null,
    ]);
    assert.deepEqual(c.ntfy, ["jobccq-moi"]);
    assert.deepEqual(c.webhooks, ["https://hooks.example/a", "https://hooks.example/b"]);
  });
});

describe("labelForReminderStatus", () => {
  it("traduit les ids connus", () => {
    assert.equal(labelForReminderStatus("entrevue"), "Entrevue");
    assert.equal(labelForReminderStatus("inconnu"), "inconnu");
  });
});
