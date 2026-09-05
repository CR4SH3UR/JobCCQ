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

export interface ExtractedFlag {
  id: string;
  label: string;
}

function matchFlags(
  text: string | null | undefined,
  patterns: { id: string; label: string; re: RegExp }[],
): ExtractedFlag[] {
  const src = text ?? "";
  if (!src) return [];
  const out: ExtractedFlag[] = [];
  for (const p of patterns) {
    if (p.re.test(src)) out.push({ id: p.id, label: p.label });
  }
  return out;
}

const REQUIREMENT_PATTERNS: { id: string; label: string; re: RegExp }[] = [
  { id: "asp", label: "ASP Construction", re: /\basp\s*construction\b|\bcsts\b|sant[ée]\s*[\-–]?\s*s[ée]curit[ée]\s+construction/i },
  {
    id: "carte-competence",
    label: "Carte de compétence",
    re: /carte\s+de\s+comp[ée]tence|certificat\s+de\s+comp[ée]tence|\bccq\b/i,
  },
  { id: "permis-classe-1", label: "Permis classe 1", re: /permis(?:\s+de\s+conduire)?\s+classe\s*1|\bclasse\s*1\b.{0,20}permis/i },
  { id: "permis-classe-3", label: "Permis classe 3", re: /permis(?:\s+de\s+conduire)?\s+classe\s*3|\bclasse\s*3\b.{0,20}permis/i },
  { id: "hauteur", label: "Travail en hauteur", re: /travail(?:ler)?\s+en\s+hauteur|harnais|plateforme\s+[ée]l[ée]vatrice/i },
  { id: "simdut", label: "SIMDUT", re: /\bsimdut\b|\bwhmis\b/i },
  { id: "cadenassage", label: "Cadenassage", re: /cadenassage|\blockout\b|\bloto\b/i },
];

const BENEFIT_PATTERNS: { id: string; label: string; re: RegExp }[] = [
  { id: "reer", label: "REER", re: /\breer\b|\brrsp\b|r[ée]gime\s+de\s+retraite/i },
  { id: "assurances", label: "Assurances", re: /assurances?\s+collectives?|avantages?\s+sociaux|\bbenefits?\b/i },
  {
    id: "camion",
    label: "Camion fourni",
    re: /camion\s+fourni|v[ée]hicule\s+fourni|pickup\s+fourni|camionnette\s+fournie/i,
  },
  { id: "outils", label: "Outils fournis", re: /outils?\s+fournis?/i },
  { id: "prime", label: "Prime / bonus", re: /\bbonus\b|\bprime[s]?\b/i },
];

/** Exigences fréquentes du chantier (ASP, carte CCQ, permis…) mentionnées dans le texte. */
export function extractRequirements(...parts: Array<string | null | undefined>): ExtractedFlag[] {
  return matchFlags(parts.filter(Boolean).join(" "), REQUIREMENT_PATTERNS);
}

/** Avantages extraits de la description (REER, assurances, camion fourni…). */
export function extractBenefits(...parts: Array<string | null | undefined>): ExtractedFlag[] {
  return matchFlags(parts.filter(Boolean).join(" "), BENEFIT_PATTERNS);
}
