/**
 * Textes des notifications de **rappel de candidature** (échéance « Relancer le »).
 * Pur : testable hors-ligne. L'envoi (Resend / ntfy / Expo / webhook) reste dans notify.ts.
 */
export interface DueApplicationReminder {
  jobId: string;
  title: string;
  company: string;
  status: string;
  note: string;
  remindAt: string;
  url: string;
}

const STATUS_LABEL: Record<string, string> = {
  "a-postuler": "À postuler",
  postule: "Postulé",
  entrevue: "Entrevue",
  refuse: "Refusé",
  accepte: "Accepté",
};

export function labelForReminderStatus(status?: string | null): string {
  const id = String(status ?? "").trim();
  return STATUS_LABEL[id] ?? (id || "Suivi");
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function formatReminderEmailSubject(items: DueApplicationReminder[]): string {
  const n = items.length;
  return n === 1
    ? `JobCCQ — Rappel : ${items[0]!.title}`
    : `JobCCQ — ${n} rappels de candidature`;
}

export function formatReminderEmailHtml(items: DueApplicationReminder[], candidaturesUrl: string): string {
  const rows = items
    .map((it) => {
      const meta = [it.company, it.status, it.remindAt].filter(Boolean).join(" · ");
      const note = it.note.trim()
        ? `<br><span style="color:#64748b;font-size:13px">${esc(it.note)}</span>`
        : "";
      return `<li style="margin:0 0 12px"><a href="${esc(it.url)}" style="color:#2563eb;font-weight:600;text-decoration:none">${esc(
        it.title,
      )}</a><br><span style="color:#475569;font-size:14px">${esc(meta)}</span>${note}</li>`;
    })
    .join("");
  return `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto">
    <h2 style="color:#0f172a">Rappel de candidature</h2>
    <p style="color:#475569">Échéance atteinte — à relancer aujourd'hui :</p>
    <ul style="list-style:none;padding:0">${rows}</ul>
    <p style="font-size:13px;color:#94a3b8">
      <a href="${esc(candidaturesUrl)}" style="color:#2563eb">Ouvrir Mes candidatures</a>
    </p></div>`;
}

export function formatReminderNtfy(items: DueApplicationReminder[]): { title: string; body: string } {
  const n = items.length;
  const title = n === 1 ? `JobCCQ — Rappel : ${items[0]!.title}` : `JobCCQ — ${n} rappels de candidature`;
  const lines = items.slice(0, 8).map((it) => {
    const who = it.company ? ` — ${it.company}` : "";
    return `• ${it.title}${who}${it.status ? ` (${it.status})` : ""}`;
  });
  if (items.length > 8) lines.push(`… et ${items.length - 8} autre(s)`);
  return { title, body: `À relancer :\n${lines.join("\n")}` };
}

export function formatReminderPush(items: DueApplicationReminder[]): { title: string; body: string; jobId: string } {
  const n = items.length;
  const first = items[0]!;
  const title = n === 1 ? "JobCCQ — Rappel de candidature" : `JobCCQ — ${n} rappels de candidature`;
  const body =
    n === 1
      ? `Relancer : ${first.title}${first.company ? ` · ${first.company}` : ""}`
      : items
          .slice(0, 3)
          .map((it) => it.title)
          .join(" · ");
  return { title, body, jobId: first.jobId };
}

/** Topics ntfy / webhooks déjà configurés sur les alertes emploi du compte. */
export function collectAlertChannels(
  queries: Array<{ ntfyTopic?: string; webhookUrl?: string } | null | undefined>,
): { ntfy: string[]; webhooks: string[] } {
  const ntfy = new Set<string>();
  const webhooks = new Set<string>();
  for (const q of queries) {
    const t = q?.ntfyTopic?.trim();
    if (t) ntfy.add(t);
    const w = q?.webhookUrl?.trim();
    if (w) webhooks.add(w);
  }
  return { ntfy: [...ntfy], webhooks: [...webhooks] };
}
