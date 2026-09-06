/**
 * Invitations calendrier (.ics) pour les rappels de candidature.
 * iOS : fichier / data URI. Android : Google Agenda (sinon Chrome
 * télécharge le .ics). Dates en journée entière.
 */

export interface CalendarEvent {
  uid: string;
  title: string;
  description?: string;
  url?: string;
  /** Jour du rappel, YYYY-MM-DD. */
  date: string;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Date ICS `YYYYMMDD` ou null si invalide. */
export function icsDate(ymd: string): string | null {
  const m = DATE_RE.exec((ymd ?? "").slice(0, 10));
  return m ? `${m[1]}${m[2]}${m[3]}` : null;
}

/** Lendemain (fin exclusive d'un événement journée entière). */
export function nextIcsDate(ymd: string): string | null {
  const start = icsDate(ymd);
  if (!start) return null;
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
}

export function escapeIcsText(raw: string): string {
  return raw
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/** Repli RFC 5545 : 75 octets, suite précédée d'une espace. */
export function foldIcsLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let offset = 0;
  let first = true;
  while (offset < bytes.length) {
    const budget = first ? 75 : 74;
    let end = Math.min(offset + budget, bytes.length);
    while (end > offset && ((bytes[end] ?? 0) & 0xc0) === 0x80) end -= 1;
    if (end === offset) end = Math.min(offset + budget, bytes.length);
    const chunk = decoder.decode(bytes.slice(offset, end));
    parts.push(first ? chunk : ` ${chunk}`);
    first = false;
    offset = end;
  }
  return parts.join("\r\n");
}

function dtstamp(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}T${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}Z`;
}

export function reminderCalendarEvent(input: {
  jobId: string;
  title: string;
  company?: string;
  statusLabel?: string;
  note?: string;
  remindAt: string;
  url?: string;
}): CalendarEvent | null {
  if (!icsDate(input.remindAt)) return null;
  const jobId = String(input.jobId ?? "").trim();
  const title = String(input.title ?? "").trim() || jobId;
  if (!jobId) return null;
  const company = (input.company ?? "").trim();
  const desc = [
    company ? `Employeur : ${company}` : "",
    input.statusLabel ? `Statut : ${input.statusLabel}` : "",
    (input.note ?? "").trim() ? `Note : ${input.note!.trim()}` : "",
    input.url ? `Fiche : ${input.url}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    uid: `jobccq-candidature-${jobId}@jobccqc.ca`,
    title: company ? `Relancer : ${title} — ${company}` : `Relancer : ${title}`,
    description: desc || undefined,
    url: input.url,
    date: input.remindAt.slice(0, 10),
  };
}

function vevent(ev: CalendarEvent, now: Date): string[] {
  const start = icsDate(ev.date);
  const end = nextIcsDate(ev.date);
  if (!start || !end) return [];
  const lines = [
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${dtstamp(now)}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeIcsText(ev.title)}`,
  ];
  if (ev.description) lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
  if (ev.url) lines.push(`URL:${ev.url}`);
  lines.push(
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(ev.title)}`,
    "TRIGGER:PT9H",
    "END:VALARM",
    "END:VEVENT",
  );
  return lines;
}

/** Calendrier iCalendar (CRLF). Tableau vide → chaîne vide. */
export function icsCalendar(events: readonly CalendarEvent[], now = new Date()): string {
  const valid = events.filter((e) => icsDate(e.date));
  if (!valid.length) return "";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JobCCQ//Candidatures//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:JobCCQ — Rappels candidatures",
  ];
  for (const ev of valid) lines.push(...vevent(ev, now));
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/** Lien « Ajouter » Google Calendar (journée entière). */
export function googleCalendarUrl(event: CalendarEvent): string | null {
  const start = icsDate(event.date);
  const end = nextIcsDate(event.date);
  if (!start || !end) return null;
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
  });
  if (event.description) q.set("details", event.description);
  if (event.url) q.set("location", event.url);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** Chrome Android télécharge un `data:text/calendar` : on passe par Google Agenda (ouvre l'appli). */
export function isAndroidUserAgent(ua: string): boolean {
  return /Android/i.test(ua) && !/Windows Phone/i.test(ua);
}

/** Href à ouvrir pour ajouter le rappel (Android ≠ iOS). */
export function calendarOpenHref(event: CalendarEvent, ua: string, icsHref: string): string {
  if (isAndroidUserAgent(ua)) return googleCalendarUrl(event) ?? icsHref;
  return icsHref;
}
