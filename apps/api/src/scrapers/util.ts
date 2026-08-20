/**
 * Utilitaires partagés par les scrapers HTML.
 * Fonctions pures (aucun réseau) — donc testables hors-ligne.
 */
import type { RawJob } from "@jobccq/shared";

/** Rend une URL absolue à partir d'une base (origine d'un site). */
export function absolute(base: string, href: string): string {
  if (!href) return base;
  if (/^https?:\/\//i.test(href)) return href;
  try {
    return new URL(href, base).toString();
  } catch {
    return `${base}${href.startsWith("/") ? "" : "/"}${href}`;
  }
}

/** Compacte les espaces (y compris insécables) et coupe. */
export function cleanText(s?: string | null): string {
  return (s ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

/** « exfo-inc » → « Exfo Inc » (repli quand la source n'expose pas le nom). */
export function deslugify(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ")
    .trim();
}

const MONTHS_FR: Record<string, number> = {
  janvier: 0, fevrier: 1, "février": 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, aout: 7, "août": 7, septembre: 8, octobre: 9, novembre: 10,
  decembre: 11, "décembre": 11,
};

/**
 * Convertit une date française (absolue ou relative) en ISO.
 *  · « 20 août 2026 »               → date absolue
 *  · « Publié aujourd'hui/hier »    → maintenant / hier
 *  · « il y a 3 jours / 2 semaines / 1 mois » → date approximative
 * Renvoie `undefined` si rien n'est reconnu.
 */
export function parseFrenchDate(text?: string | null, now = new Date()): string | undefined {
  const t = cleanText(text).toLowerCase();
  if (!t) return undefined;

  if (/aujourd'?hui|à l'instant|maintenant/.test(t)) return now.toISOString();
  if (/\bhier\b/.test(t)) return new Date(now.getTime() - 864e5).toISOString();

  const rel = t.match(/il y a\s+(\d+)\s+(jour|semaine|mois|an|année|annee|heure|minute)/);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2]!;
    const ms =
      unit.startsWith("minute") ? 6e4 :
      unit.startsWith("heure") ? 36e5 :
      unit === "jour" ? 864e5 :
      unit === "semaine" ? 7 * 864e5 :
      unit === "mois" ? 30 * 864e5 :
      365 * 864e5;
    return new Date(now.getTime() - n * ms).toISOString();
  }

  const abs = t.match(/(\d{1,2})\s+([a-zà-ÿ]+)\.?\s+(\d{4})/);
  if (abs) {
    const day = Number(abs[1]);
    const month = MONTHS_FR[abs[2]!];
    const year = Number(abs[3]);
    if (month != null) return new Date(Date.UTC(year, month, day)).toISOString();
  }

  const iso = Date.parse(t);
  return Number.isNaN(iso) ? undefined : new Date(iso).toISOString();
}

/** Texte français d'un type de poste → enum EMPLOYMENT_TYPES. */
export function mapEmploymentType(text?: string | null): RawJob["employmentType"] {
  const t = cleanText(text).toLowerCase();
  if (!t) return undefined;
  if (/stage|stagiaire|internship/.test(t)) return "stage";
  if (/saisonnier|seasonal/.test(t)) return "saisonnier";
  if (/occasionnel|sur appel|per diem/.test(t)) return "occasionnel";
  if (/temps partiel|part[- ]?time/.test(t)) return "temps-partiel";
  if (/contrat|contractuel|temporaire|pige|freelance|contract/.test(t)) return "contrat";
  if (/temps plein|permanent|full[- ]?time/.test(t)) return "temps-plein";
  return undefined;
}

/** Unité de salaire schema.org / Espresso → période. */
export function mapSalaryUnit(unit?: string | null): RawJob["salaryPeriod"] {
  const u = cleanText(unit).toLowerCase();
  if (/hour|heure|horaire/.test(u)) return "heure";
  if (/week|semaine|hebdo/.test(u)) return "semaine";
  if (/month|mois|mensuel/.test(u)) return "mois";
  if (/year|annu|annee|année|an\b/.test(u)) return "annee";
  return undefined;
}
