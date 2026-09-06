/**
 * Date limite de candidature extraite du titre / de la description (idée 104).
 * Pas persistée : calculée à la lecture.
 */

const MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, january: 1, jan: 1,
  fevrier: 2, février: 2, fevr: 2, févr: 2, february: 2, feb: 2,
  mars: 3, march: 3, mar: 3,
  avril: 4, avr: 4, april: 4, apr: 4,
  mai: 5, may: 5,
  juin: 6, june: 6, jun: 6,
  juillet: 7, juil: 7, july: 7, jul: 7,
  aout: 8, août: 8, august: 8, aug: 8,
  septembre: 9, sept: 9, september: 9, sep: 9,
  octobre: 10, oct: 10, october: 10,
  novembre: 11, nov: 11, november: 11,
  decembre: 12, décembre: 12, dec: 12, déc: 12, december: 12,
};

const ISO_RE = /\b(20\d{2})-(\d{2})-(\d{2})\b/;
const SLASH_RE = /\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/;
const FR_RE =
  /\b(\d{1,2})\s+(janvier|janv\.?|février|fevrier|févr\.?|fevr\.?|mars|avril|avr\.?|mai|juin|juillet|juil\.?|août|aout|septembre|sept\.?|octobre|oct\.?|novembre|nov\.?|décembre|decembre|déc\.?|dec\.?)\s*(20\d{2})?\b/i;
const EN_RE =
  /\b(january|jan\.?|february|feb\.?|march|mar\.?|april|apr\.?|may|june|jun\.?|july|jul\.?|august|aug\.?|september|sept\.?|sep\.?|october|oct\.?|november|nov\.?|december|dec\.?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s*(20\d{2})?\b/i;

const CONTEXT =
  /date\s+limite|date\s+de\s+cl[ôo]ture|avant\s+le|d['’]ici\s+le|jusqu['’]au|postuler\s+avant|candidatures?\s+avant|ferme\s+le|ferm[ée]e?\s+le|closing\s+date|apply\s+by|deadline|échéance/i;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function monthNum(raw: string): number | null {
  const key = raw.replace(/\./g, "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return MONTHS[key] ?? MONTHS[raw.replace(/\./g, "").toLowerCase()] ?? null;
}

function inferYear(month: number, day: number, explicit?: string, now = new Date()): number {
  if (explicit) return Number(explicit);
  const year = now.getFullYear();
  const candidate = Date.UTC(year, month - 1, day);
  const today = Date.UTC(year, now.getMonth(), now.getDate());
  return candidate < today ? year + 1 : year;
}

/** YYYY-MM-DD si une date limite est mentionnée, sinon null. */
export function extractClosesAt(
  ...parts: Array<string | null | undefined>
): string | null {
  const text = parts.filter(Boolean).join(" \n ");
  if (!text || !CONTEXT.test(text)) return null;

  const iso = text.match(ISO_RE);
  if (iso) return ymd(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slash = text.match(SLASH_RE);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const y = Number(slash[3]);
    // JJ/MM/AAAA (QC) sauf si le 1er champ > 12 → déjà jour.
    if (a > 12) return ymd(y, b, a);
    return ymd(y, b, a);
  }

  const fr = text.match(FR_RE);
  if (fr) {
    const day = Number(fr[1]);
    const month = monthNum(fr[2] ?? "");
    if (month) return ymd(inferYear(month, day, fr[3]), month, day);
  }

  const en = text.match(EN_RE);
  if (en) {
    const month = monthNum(en[1] ?? "");
    const day = Number(en[2]);
    if (month) return ymd(inferYear(month, day, en[3]), month, day);
  }

  return null;
}

/** Libellé court FR, ex. « 20 sept. 2026 ». */
export function formatClosesAt(iso: string): string {
  const t = Date.parse(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(t)) return iso;
  return new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", year: "numeric" }).format(t);
}

/** Timestamp de tri : date limite, ou +∞ si absente / passée trop loin. */
export function closesAtSortValue(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(`${iso.slice(0, 10)}T23:59:59`);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}
