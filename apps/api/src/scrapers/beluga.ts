import { makeZohoRecruitScraper } from "./zoho-recruit.js";

/**
 * Béluga Construction — entrepreneur en génie civil, égout/aqueduc et mines.
 * Portail carrières Zoho Recruit (.ca). Le flux RSS étant désactivé, les offres
 * sont lues depuis le JSON embarqué de la page carrières.
 */
export const belugaScraper = makeZohoRecruitScraper({
  id: "beluga",
  company: "Béluga Construction",
  careersUrl: "https://constructionbeluga.zohorecruit.ca/jobs/Careers",
});
