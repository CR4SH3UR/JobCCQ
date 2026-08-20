import { makeCareersScraper } from "./careers.js";

/**
 * Pomerleau — portail carrières (ATS) sur un sous-domaine dédié.
 * Statut : expérimental. Les offres d'un ATS sont souvent chargées en
 * JavaScript : ce scraper tente d'abord le JSON-LD puis les liens HTML, mais
 * un rendu headless (Playwright) ou l'API de l'ATS peut s'avérer nécessaire.
 */
export const pomerleauScraper = makeCareersScraper({
  id: "pomerleau",
  company: "Pomerleau",
  careersUrl: "https://careers.pomerleau.ca",
});
