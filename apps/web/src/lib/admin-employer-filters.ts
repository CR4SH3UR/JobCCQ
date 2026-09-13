/** URL carrières absente ou inutilisable (vide, null sérialisé). */
export function isMissingCareersUrl(url: string | null | undefined): boolean {
  const v = (url ?? "").trim();
  if (!v) return true;
  const lower = v.toLowerCase();
  return lower === "null" || lower === "undefined";
}

/** Normalise une valeur SQL / JSON vers une URL, ou chaîne vide si absente. */
export function normalizeCareersUrl(value: unknown): string {
  if (value == null) return "";
  const s = String(value).trim();
  return isMissingCareersUrl(s) ? "" : s;
}
