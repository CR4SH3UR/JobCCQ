import { refineCareers } from "./careers.js";

/**
 * Avivia (armoires de cuisine / menuiserie) — page carrières WordPress. Les
 * vraies fiches vivent sous /emplois/<slug>/ ; on filtre sur ce motif pour
 * écarter le lien « Postuler » (même page) et « offre-aux-entrepreneurs ».
 */
export const aviviaScraper = refineCareers({
  id: "avivia-ca",
  company: "Avivia",
  careersUrl: "https://avivia.ca/carriere/",
  jobPathPattern: /\/emplois\//,
});
