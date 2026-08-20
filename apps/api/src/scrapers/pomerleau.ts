import { makeAvatureScraper } from "./avature.js";

/**
 * Pomerleau — grand entrepreneur en construction / génie civil.
 * Portail carrières Avature (jobs.pomerleau.ca) ; les offres sont lues via le
 * endpoint SearchJobs, paginé par `jobOffset`. Plafonné (portail national
 * volumineux) — ajustable via AVATURE_MAX_JOBS.
 */
export const pomerleauScraper = makeAvatureScraper({
  id: "pomerleau",
  company: "Pomerleau",
  searchUrl: "https://jobs.pomerleau.ca/fr_CA/Jobs/SearchJobs",
  maxJobs: 60,
});
