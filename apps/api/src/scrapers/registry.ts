import type { Scraper } from "./types.js";
import { jobillicoScraper } from "./jobillico.js";
import { espressoJobsScraper } from "./espresso-jobs.js";
import { guichetEmploisScraper } from "./guichet-emplois.js";
import { atwillMorinScraper } from "./atwill-morin.js";
import { hamelConstructionScraper } from "./hamel-construction.js";

/**
 * Registre des scrapers branchés. La clé correspond à l'`id` de la source
 * dans le répertoire (packages/shared/src/sources.ts).
 *
 * Pour ajouter une source : implémente un Scraper puis ajoute-le ici.
 */
export const SCRAPERS: Record<string, Scraper> = {
  [jobillicoScraper.id]: jobillicoScraper,
  [espressoJobsScraper.id]: espressoJobsScraper,
  [guichetEmploisScraper.id]: guichetEmploisScraper,
  [atwillMorinScraper.id]: atwillMorinScraper,
  [hamelConstructionScraper.id]: hamelConstructionScraper,
};

export function getScraper(id: string): Scraper | undefined {
  return SCRAPERS[id];
}

export function listScraperIds(): string[] {
  return Object.keys(SCRAPERS);
}
