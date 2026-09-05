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
