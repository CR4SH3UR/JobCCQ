import { makeJobillicoEmployerScraper } from "./jobillico-employer.js";

/**
 * Claveau Et Fils inc. — entrepreneur général (Saguenay).
 * La page WordPress `/carrieres/` n'est qu'un formulaire de candidature
 * (menu « Poste désiré »). Les postes ouverts sont sur Jobillico
 * (ItemList → fiches JobPosting).
 */
export const claveauEtFilsScraper = makeJobillicoEmployerScraper({
  id: "claveauetfils-ca",
  company: "Claveau Et Fils inc.",
  listUrl: "https://www.jobillico.com/fr/employeurs/claveau-fils-inc/voir-liste-emplois",
});
