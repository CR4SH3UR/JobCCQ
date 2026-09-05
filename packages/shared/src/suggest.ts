/**
 * Classement des suggestions d'autocomplétion — fonction pure, partagée par le
 * site et l'app. On classe des entrées de vocabulaire (métiers, entreprises,
 * villes…) par rapport à une requête : préfixe > sous-chaîne > faute de frappe.
 */
import { normalizeText, boundedLevenshtein, typoTolerance } from "./text.js";

export type SuggestionKind = "metier" | "entreprise" | "ville" | "categorie";

export interface SuggestEntry {
  /** Valeur insérée dans le champ quand on sélectionne la suggestion. */
  readonly value: string;
  readonly kind: SuggestionKind;
}

export interface Suggestion extends SuggestEntry {
  readonly label: string;
  readonly score: number;
}

/** Score d'une entrée pour la requête (0 = ne correspond pas). */
function scoreEntry(normalizedQuery: string, value: string): number {
  const nv = normalizeText(value);
  if (!nv) return 0;
  if (nv === normalizedQuery) return 100;
  if (nv.startsWith(normalizedQuery)) return 80 - Math.min(20, nv.length - normalizedQuery.length);
  if (nv.includes(normalizedQuery)) return 55;

  const max = typoTolerance(normalizedQuery);
  if (max > 0) {
    // Faute de frappe : début du candidat proche de la requête…
    const head = nv.slice(0, normalizedQuery.length + 1);
    if (boundedLevenshtein(head, normalizedQuery, max) <= max) return 35;
    // …ou l'un des mots du candidat proche de la requête.
    for (const w of nv.split(/\s+/)) {
      if (Math.abs(w.length - normalizedQuery.length) <= max && boundedLevenshtein(w, normalizedQuery, max) <= max) {
        return 30;
      }
    }
  }
  return 0;
}

/**
 * Suggestions classées pour `query` parmi `entries`. Dédoublonne par
 * (kind, valeur normalisée). Ne renvoie rien tant que la requête fait moins de
 * 2 caractères.
 */
export function suggest(query: string, entries: readonly SuggestEntry[], limit = 8): Suggestion[] {
  const q = normalizeText(query.trim());
  if (q.length < 2) return [];

  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const key = `${e.kind}|${normalizeText(e.value)}`;
    if (seen.has(key)) continue;
    const score = scoreEntry(q, e.value);
    if (score <= 0) continue;
    seen.add(key);
    out.push({ ...e, label: e.value, score });
  }

  return out
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "fr"))
    .slice(0, limit);
}
