const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g;
const FAKE_EMAIL = /example\.com$|sentry\.|wixpress|localhost|domain\.com$/i;

export interface ExtractedContacts {
  emails: string[];
  phones: string[];
}

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of items) {
    const k = x.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

/** Courriels et téléphones publics extraits d'une description d'offre. */
export function extractContacts(text?: string | null): ExtractedContacts {
  const src = text ?? "";
  const emails = uniq((src.match(EMAIL_RE) ?? []).filter((e) => !FAKE_EMAIL.test(e)));
  const phones = uniq(src.match(PHONE_RE) ?? []);
  return { emails, phones };
}

export const WORK_SHIFTS = [
  { id: "nuit", label: "Nuit" },
  { id: "soir", label: "Soir" },
  { id: "jour", label: "Jour" },
] as const;

export type WorkShiftId = (typeof WORK_SHIFTS)[number]["id"];

export const WORK_SHIFT_FILTERS: { id: WorkShiftId; label: string }[] = [
  { id: "jour", label: "Jour" },
  { id: "soir", label: "Soir" },
  { id: "nuit", label: "Nuit" },
];

const SHIFT_PATTERNS: { id: WorkShiftId; re: RegExp }[] = [
  { id: "nuit", re: /quart\s+de\s+nuit|\bde\s+nuit\b|night\s+shift|\bnight\s+shift\b|\bgraveyard\b/i },
  { id: "soir", re: /quart\s+de\s+soir|horaire\s+de\s+soir|\bevening\s+shift\b|\bde\s+soir[ée]e?\b/i },
  { id: "jour", re: /quart\s+de\s+jour|horaire\s+de\s+jour|\bday\s+shift\b|\bde\s+jour\b/i },
];

/** Quart de travail mentionné dans le titre ou la description, si c'est explicite. */
export function detectShift(...parts: Array<string | null | undefined>): WorkShiftId | undefined {
  const text = parts.filter(Boolean).join(" ");
  if (!text) return undefined;
  for (const { id, re } of SHIFT_PATTERNS) {
    if (re.test(text)) return id;
  }
  return undefined;
}
