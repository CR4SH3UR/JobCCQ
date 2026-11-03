/**
 * Gros employeurs scrapés **chaque jour** (le reste reste à 2×/semaine).
 * Volume d'offres élevé + forte intention de recherche sur la marque.
 */
export const DAILY_SCRAPE_IDS: readonly string[] = [
  "pomerleau",
  "broccolini-com",
  "ebc",
  "ccq-construction",
  "magil-construction",
  "aecon-group-inc",
];

/** Liste CSV pour le workflow GitHub Actions (`SCRAPE_IDS=…`). */
export function dailyScrapeIdsCsv(): string {
  return DAILY_SCRAPE_IDS.join(",");
}
