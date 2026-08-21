import { DISCOVERED_EMPLOYERS } from "@jobccq/shared";
import type { Scraper } from "./types.js";
import { atwillMorinScraper } from "./atwill-morin.js";
import { hamelConstructionScraper } from "./hamel-construction.js";
import { pomerleauScraper } from "./pomerleau.js";
import { lafontaineScraper } from "./lafontaine.js";
import { ebcScraper } from "./ebc.js";
import { leqelScraper } from "./leqel.js";
import { belugaScraper } from "./beluga.js";
import { jmDemersScraper } from "./jmdemers.js";
import { coteEtFilsScraper } from "./cote-et-fils.js";
import { lefrancoisScraper } from "./lefrancois.js";
import { jcDroletScraper } from "./jcdrolet.js";
import { refrabecScraper } from "./refrabec.js";
import { amenagementGrenonScraper } from "./amenagement-grenon.js";
import { buildDiscoveredScraper } from "./discovered.js";

/**
 * Scrapers **sur mesure** (bespoke) de certains employeurs, indexés par id.
 *
 * Ces employeurs sont désormais décrits dans `discovered.json` (donc visibles et
 * éditables dans la console d'admin, comme tous les autres), mais gardent leur
 * parseur dédié — plus fiable que le repli générique par méthode (flux RSS
 * WordPress d'EBC, portail Avature de Pomerleau, JSON Zoho de Béluga…). Pour tous
 * les autres employeurs, on construit le scraper à partir de la méthode détectée.
 */
const BESPOKE: Record<string, Scraper> = {
  [atwillMorinScraper.id]: atwillMorinScraper,
  [hamelConstructionScraper.id]: hamelConstructionScraper,
  [pomerleauScraper.id]: pomerleauScraper,
  [lafontaineScraper.id]: lafontaineScraper,
  [ebcScraper.id]: ebcScraper,
  [leqelScraper.id]: leqelScraper,
  [belugaScraper.id]: belugaScraper,
  [jmDemersScraper.id]: jmDemersScraper,
  [coteEtFilsScraper.id]: coteEtFilsScraper,
  [lefrancoisScraper.id]: lefrancoisScraper,
  [jcDroletScraper.id]: jcDroletScraper,
  [refrabecScraper.id]: refrabecScraper,
  [amenagementGrenonScraper.id]: amenagementGrenonScraper,
};

/**
 * Registre des scrapers branchés. La clé est l'`id` de l'employeur dans
 * `discovered.json`. Les sources désactivées (`enabled === false`) ne sont pas
 * branchées. Chaque employeur utilise son scraper bespoke s'il en a un, sinon le
 * scraper générique construit à partir de sa méthode.
 */
export const SCRAPERS: Record<string, Scraper> = Object.fromEntries(
  DISCOVERED_EMPLOYERS.filter((d) => d.enabled !== false).map((d) => [
    d.id,
    BESPOKE[d.id] ?? buildDiscoveredScraper(d),
  ]),
);

export function getScraper(id: string): Scraper | undefined {
  return SCRAPERS[id];
}

/**
 * Scraper sur mesure pour cet id, s'il en existe un (sinon undefined). La console
 * d'admin l'utilise en priorité ; pour les autres employeurs elle reconstruit le
 * scraper à partir de la config éditée (afin de prendre en compte une URL modifiée).
 */
export function bespokeScraper(id: string): Scraper | undefined {
  return BESPOKE[id];
}

export function listScraperIds(): string[] {
  return Object.keys(SCRAPERS);
}
