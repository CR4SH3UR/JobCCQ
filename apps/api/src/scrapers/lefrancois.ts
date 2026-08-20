import { makeCareersScraper } from "./careers.js";

/**
 * Lefrançois — entrepreneur en construction (coffrage, béton, génie civil).
 * Page carrières Wix : postes lus depuis les intitulés (repli « titres »).
 */
export const lefrancoisScraper = makeCareersScraper({
  id: "lefrancois",
  company: "Lefrançois",
  careersUrl: "https://www.lefrancoisinc.ca/carri%C3%A8res",
});
