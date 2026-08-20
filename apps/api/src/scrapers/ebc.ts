import { makeWpJobFeedScraper } from "./wp-job-feed.js";

/**
 * EBC Construction — génie civil, bâtiment et mines.
 * Page carrières WordPress alimentée en AJAX ; les postes sont exposés via le
 * flux RSS du type d'article « job ».
 */
export const ebcScraper = makeWpJobFeedScraper({
  id: "ebc",
  company: "EBC",
  feedUrl: "https://ebcinc.com/fr/job/feed/",
});
