import { makeBambooHrScraper } from "./bamboohr.js";

/**
 * Atwill-Morin — maçonnerie et restauration de bâtiments.
 * La page carrières (WordPress) charge ses postes depuis BambooHR ;
 * on lit le flux JSON public de l'ATS (atwillmorin.bamboohr.com).
 */
export const atwillMorinScraper = makeBambooHrScraper({
  id: "atwill-morin",
  company: "Atwill-Morin",
  subdomain: "atwillmorin",
});
