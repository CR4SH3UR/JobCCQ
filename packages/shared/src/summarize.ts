const MIN_TEXT = 80;
const MIN_BULLET = 28;
const MAX_BULLET = 180;
const MAX_OUT = 3;

function cleanLine(s: string): string {
  return s
    .replace(/^[\s•\-–—*·]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;:]+$/, "");
}

function isUseful(s: string): boolean {
  if (s.length < MIN_BULLET || s.length > MAX_BULLET) return false;
  if (/@|https?:\/\//i.test(s)) return false;
  if (/^(avantages?|exigences?|nous\s+offrons|postulez|contact)/i.test(s)) return false;
  return /[a-zàâäéèêëïîôùûüç]/i.test(s);
}

/**
 * Résumé extractif d'une description d'offre : 2-3 puces (listes à puces
 * d'abord, sinon les premières phrases substantielles). Pas de LLM.
 */
export function summarizeDescription(text?: string | null): string[] {
  const src = (text ?? "").trim();
  if (src.length < MIN_TEXT) return [];
  // Extrait client (~240 car. + …) : trop court pour un vrai résumé.
  if (src.endsWith("…") && src.length <= 240) return [];

  const bulletLines = src
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => /^(\s*[-–—*•·]|\d+[.)]\s)/.test(l))
    .map(cleanLine)
    .filter(isUseful);

  if (bulletLines.length >= 2) return bulletLines.slice(0, MAX_OUT);

  const sentences = src
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map(cleanLine)
    .filter(isUseful);

  return sentences.slice(0, MAX_OUT);
}
