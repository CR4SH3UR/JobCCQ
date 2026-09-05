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
import { guayScraper } from "./guay.js";
import { cafortierScraper } from "./cafortier.js";
import { canamScraper, groupeCanamDuplicateScraper } from "./canam.js";
import { revencoScraper } from "./revenco.js";
import { lescharpentistesScraper } from "./lescharpentistes.js";
import { stefetmaxScraper } from "./stefetmax.js";
import { droletConstructionScraper } from "./droletconstruction.js";
import { electriciteMc2Scraper } from "./electricitemc2.js";
import { glrScraper } from "./glr.js";
import { excavationsRsrScraper } from "./excavationsrsr.js";
import { galileeScraper } from "./galilee.js";
import { intermatScraper } from "./intermat.js";
import { riouxScraper } from "./rioux.js";
import { atkinsRealisScraper } from "./atkinsrealis.js";
import { arteliaScraper } from "./artelia.js";
import { ascenseursAbsoluScraper } from "./ascenseurs-absolu.js";
import { atelierEnHauteurScraper } from "./atelier-en-hauteur.js";
import { atlasApexScraper } from "./atlas-apex.js";
import { audetEntrepreneurPeintreScraper } from "./audet-entrepreneur-peintre.js";
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
  [guayScraper.id]: guayScraper,
  [cafortierScraper.id]: cafortierScraper,
  [canamScraper.id]: canamScraper,
  [groupeCanamDuplicateScraper.id]: groupeCanamDuplicateScraper,
  [revencoScraper.id]: revencoScraper,
  [lescharpentistesScraper.id]: lescharpentistesScraper,
  [stefetmaxScraper.id]: stefetmaxScraper,
  [droletConstructionScraper.id]: droletConstructionScraper,
  [electriciteMc2Scraper.id]: electriciteMc2Scraper,
  [glrScraper.id]: glrScraper,
  [excavationsRsrScraper.id]: excavationsRsrScraper,
  [galileeScraper.id]: galileeScraper,
  [intermatScraper.id]: intermatScraper,
  [riouxScraper.id]: riouxScraper,
  [atkinsRealisScraper.id]: atkinsRealisScraper,
  [arteliaScraper.id]: arteliaScraper,
  [ascenseursAbsoluScraper.id]: ascenseursAbsoluScraper,
  [atelierEnHauteurScraper.id]: atelierEnHauteurScraper,
  [atlasApexScraper.id]: atlasApexScraper,
  [audetEntrepreneurPeintreScraper.id]: audetEntrepreneurPeintreScraper,
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
