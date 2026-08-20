import { makeJobillicoEmployerScraper } from "./jobillico-employer.js";

/**
 * Construction Côté et fils — entrepreneur en construction.
 * Page employeur Jobillico (ItemList → fiches JobPosting).
 */
export const coteEtFilsScraper = makeJobillicoEmployerScraper({
  id: "cote-et-fils",
  company: "Construction Côté et fils",
  listUrl: "https://www.jobillico.com/voir-entreprise/construction-cote-fils.tZkiVw",
});
