import { makeCareersScraper } from "./careers.js";

/**
 * Atwill-Morin — page carrières d'entreprise (maçonnerie / restauration).
 * Statut : expérimental (sélecteurs du repli HTML à valider contre le DOM réel).
 */
export const atwillMorinScraper = makeCareersScraper({
  id: "atwill-morin",
  company: "Atwill-Morin",
  careersUrl: "https://atwill-morin.com/carrieres/",
});
