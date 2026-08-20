import { makeJobillicoEmployerScraper } from "./jobillico-employer.js";

/**
 * Construction & Pavage Portneuf — pavage, terrassement, génie civil.
 * Page employeur Jobillico (ItemList → fiches JobPosting).
 */
export const portneufScraper = makeJobillicoEmployerScraper({
  id: "portneuf",
  company: "Construction & Pavage Portneuf",
  listUrl:
    "https://www.jobillico.com/fr/employeurs/construction-pavage-portneuf-inc-eBlqIn/voir-liste-emplois",
});
