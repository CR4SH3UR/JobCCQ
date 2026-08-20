import { makeZohoRecruitScraper } from "./zoho-recruit.js";

/**
 * Les Excavations Lafontaine — entrepreneur en génie civil / construction.
 * Portail carrières Zoho Recruit ; on lit le flux RSS des postes publiés.
 */
export const lafontaineScraper = makeZohoRecruitScraper({
  id: "lafontaine",
  company: "Lafontaine",
  rssUrl: "https://lafontaineinc.zohorecruit.com/jobs/Careers/rss",
});
