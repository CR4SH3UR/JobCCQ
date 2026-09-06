/**
 * Effectifs de **main-d'œuvre active par métier CCQ** — TABLE ÉDITABLE.
 *
 * Sert le baromètre de tension (offres ouvertes rapportées à la taille de la
 * main-d'œuvre du métier). À remplir avec les **chiffres publics de la CCQ**
 * (rapports annuels / statistiques de l'industrie — https://www.ccq.org).
 *
 * Convention : laisser un métier **absent** (ou `null`) tant que le chiffre
 * n'est pas connu — le baromètre affiche alors « à renseigner » plutôt que
 * d'inventer une valeur. La clé DOIT être un id de `CCQ_TRADES` (garde-fou :
 * `unknownWorkforceIds()`, testé). Exemple à confirmer et décommenter :
  
Briqueteur-maçon: 5 228,
 *   electricien: 21000,
 *   charpentier-menuisier: 45000,
 */
import { CCQ_TRADES } from "./ccq.js";

export const CCQ_WORKFORCE: Readonly<Record<string, number | null>> = {
  // À compléter avec les effectifs officiels CCQ, un métier par ligne.
};

/** Effectif d'un métier, ou `null` si non renseigné. */
export function workforceFor(tradeId: string): number | null {
  return CCQ_WORKFORCE[tradeId] ?? null;
}

/**
 * Clés de `CCQ_WORKFORCE` qui ne correspondent à aucun métier CCQ — garde-fou
 * contre une faute de frappe dans la table (doit rester vide).
 */
export function unknownWorkforceIds(): string[] {
  const ids = new Set(CCQ_TRADES.map((t) => t.id));
  return Object.keys(CCQ_WORKFORCE).filter((k) => !ids.has(k));
}

/**
 * « Tension » d'un métier = nombre d'offres ouvertes **pour 1000 travailleurs
 * actifs** (plus c'est élevé, plus la demande est forte relativement à la
 * main-d'œuvre disponible). `null` si l'effectif n'est pas renseigné.
 */
export function tensionPer1000(offers: number, workforce: number | null): number | null {
  if (!workforce || workforce <= 0) return null;
  return (offers / workforce) * 1000;
}
