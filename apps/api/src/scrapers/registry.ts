import type { Scraper } from "./types.js";
import { atwillMorinScraper } from "./atwill-morin.js";
import { hamelConstructionScraper } from "./hamel-construction.js";
import { pomerleauScraper } from "./pomerleau.js";
import { lafontaineScraper } from "./lafontaine.js";
import { ebcScraper } from "./ebc.js";
import { leqelScraper } from "./leqel.js";
import { belugaScraper } from "./beluga.js";
import { jmDemersScraper } from "./jmdemers.js";
import { portneufScraper } from "./portneuf.js";
import { coteEtFilsScraper } from "./cote-et-fils.js";
import { lefrancoisScraper } from "./lefrancois.js";
import { jcDroletScraper } from "./jcdrolet.js";
import { refrabecScraper } from "./refrabec.js";
import { discoveredScrapers } from "./discovered.js";

/**
 * Registre des scrapers branchés. La clé correspond à l'`id` de la source
 * dans le répertoire (packages/shared/src/sources.ts).
 *
 * Pour ajouter une source : implémente un Scraper puis ajoute-le ici.
 */
export const SCRAPERS: Record<string, Scraper> = {
  [atwillMorinScraper.id]: atwillMorinScraper,
  [hamelConstructionScraper.id]: hamelConstructionScraper,
  [pomerleauScraper.id]: pomerleauScraper,
  [lafontaineScraper.id]: lafontaineScraper,
  [ebcScraper.id]: ebcScraper,
  [leqelScraper.id]: leqelScraper,
  [belugaScraper.id]: belugaScraper,
  [jmDemersScraper.id]: jmDemersScraper,
  [portneufScraper.id]: portneufScraper,
  [coteEtFilsScraper.id]: coteEtFilsScraper,
  [lefrancoisScraper.id]: lefrancoisScraper,
  [jcDroletScraper.id]: jcDroletScraper,
  [refrabecScraper.id]: refrabecScraper,
  // Employeurs auto-découverts (registre RBQ).
  ...discoveredScrapers,
};

export function getScraper(id: string): Scraper | undefined {
  return SCRAPERS[id];
}

export function listScraperIds(): string[] {
  return Object.keys(SCRAPERS);
}
