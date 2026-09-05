import { refineCareers } from "./careers.js";

/**
 * Gestion A. Godin (gestion immobilière / mécanique du bâtiment, Beloeil) —
 * page carrières « accordéon ». On écarte les lignes d'exigences captées comme
 * de faux postes (« Certificat de compétence COMPAGNON/APPRENTI de la CCQ »).
 */
export const gestionAgodinScraper = refineCareers(
  {
    id: "gestionagodin-com",
    company: "Gestion A. Godin",
    careersUrl: "https://gestionagodin.com/emplois/",
  },
  {
    drop: /certificat de comp[eé]tence|compagnon de la ccq|apprenti de la ccq/i,
    defaultLocation: "Beloeil, QC",
  },
);
