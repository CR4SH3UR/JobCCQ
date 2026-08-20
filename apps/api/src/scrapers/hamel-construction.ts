import { makeCareersScraper } from "./careers.js";

/**
 * Hamel Construction — page carrières d'entreprise (construction).
 * Statut : expérimental (sélecteurs du repli HTML à valider contre le DOM réel).
 */
export const hamelConstructionScraper = makeCareersScraper({
  id: "hamel-construction",
  company: "Hamel Construction",
  careersUrl: "https://www.hamelconstruction.com/carrieres",
});
