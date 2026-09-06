/**
 * Effectifs de **main-d'œuvre active par métier CCQ**.
 *
 * Sert le baromètre de tension (offres ouvertes rapportées à la taille de la
 * main-d'œuvre du métier). Source officielle :
 * CCQ, Tableau C 21, "Nombre de salariés selon le métier et l'occupation,
 * 2016-2025", juin 2026.
 *
 * Import reproductible :
 *   npm run import:ccq-workforce -w @jobccq/shared -- "<url-ou-fichier-pdf>"
 *
 * Convention : laisser `null` tant qu'aucune ligne CCQ équivalente n'est
 * présente dans la source. La clé DOIT être un id de `CCQ_TRADES` (garde-fou :
 * `unknownWorkforceIds()`, testé).
 */
import { CCQ_TRADES } from "./ccq.js";

export const CCQ_WORKFORCE_SOURCE = {
  title: "CCQ Tableau C 21 - Nombre de salariés selon le métier et l'occupation, 2016-2025",
  year: 2025,
  published: "juin 2026",
  url: "https://www.ccq.org/-/media/Project/Ccq/Ccq-Website/PDF/Recherche/StatistiquesHistoriques/2025/C21.pdf?rev=2b528bf7a0aa41a2b4c98076964c7dfe",
} as const;

export const CCQ_WORKFORCE: Readonly<Record<string, number | null>> = {
  "briqueteur-macon": 5228,
  calorifugeur: 1445,
  carreleur: 2821,
  "charpentier-menuisier": 56432,
  chaudronnier: 726,
  "cimentier-applicateur": 3850,
  couvreur: 6291,
  contremaitre: null,
  electricien: 25149,
  ferblantier: 5765,
  ferrailleur: 1823,
  frigoriste: 5388,
  grutier: 2073,
  "manoeuvre-specialise": null,
  manoeuvre: 25059,
  "mecanicien-ascenseur": 1341,
  "mecanicien-protection-incendie": 1810,
  "mecanicien-chantier": 1249,
  "monteur-acier": 3601,
  "monteur-vitrier": 2743,
  "operateur-equipement-lourd": 14740,
  peintre: 6862,
  platrier: 4116,
  plombier: null,
  "poseur-revetements-souples": 1336,
  "poseur-systemes-interieurs": 3021,
  "serrurier-batiment": null,
  tuyauteur: 11353,
  soudeur: 1043,
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
