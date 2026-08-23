/**
 * Constantes des pages légales (confidentialité, conditions, à propos).
 *
 * ⚠️ Ces pages sont des GABARITS conçus pour le contexte québécois (Loi 25).
 * Elles doivent être RELUES PAR UN·E JURISTE avant un lancement public.
 * Ajuste ici le nom, le courriel de contact, le responsable et la date de MAJ.
 */
export const LEGAL = {
  siteName: "JobCCQc",
  /** Courriel de contact (vie privée + demandes de retrait). */
  contactEmail: "dickie1719@gmail.com",
  /** Responsable de la protection des renseignements personnels (Loi 25). */
  privacyOfficer: "Responsable de la protection des renseignements personnels",
  /** Date de dernière mise à jour affichée sur les pages légales. */
  lastUpdated: "22 août 2026",
  jurisdiction: "province de Québec (Canada)",
} as const;
