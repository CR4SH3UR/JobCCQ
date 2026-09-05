import { CUSTOM_SCRAPER_IDS, DISCOVERED_EMPLOYERS, type CustomScraperId } from "@jobccq/shared";
import type { Scraper } from "./types.js";
import { atwillMorinScraper } from "./atwill-morin.js";
import { hamelConstructionScraper } from "./hamel-construction.js";
import { pomerleauScraper } from "./pomerleau.js";
import { plombierExpertScraper } from "./plombierexpert.js";
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
import { automationDrummondScraper } from "./automation-drummond.js";
import { aviviaScraper } from "./avivia.js";
import { bardeauxScraper } from "./bardeaux.js";
import { baretteBernardScraper } from "./barettebernard.js";
import { qmbScraper } from "./qmb.js";
import { gestionAgodinScraper } from "./gestionagodin.js";
import { baulneScraper } from "./baulne.js";
import { berardTremblayScraper } from "./berardtremblay.js";
import { constructionJrsavardScraper } from "./constructionjrsavard.js";
import { bertrandOstiguyScraper } from "./bertrandostiguy.js";
import { betonBarretteScraper } from "./betonbarrette.js";
import { brunetScraper } from "./brunet.js";
import { betonFondationPlusScraper } from "./betonfondationplus.js";
import { betonSurfaceScraper } from "./betonsurface.js";
import { bousadaScraper } from "./bousada.js";
import { bellemareScraper, groupebellemareScraper } from "./bellemare.js";
import { betonGlScraper } from "./betongl.js";
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
const BESPOKE = {
  "atwill-morin": atwillMorinScraper,
  "hamelconstruction-com": hamelConstructionScraper,
  pomerleau: pomerleauScraper,
  "plombierexpert-ca": plombierExpertScraper,
  lafontaine: lafontaineScraper,
  ebc: ebcScraper,
  leqel: leqelScraper,
  beluga: belugaScraper,
  jmdemers: jmDemersScraper,
  "cote-et-fils": coteEtFilsScraper,
  lefrancois: lefrancoisScraper,
  jcdrolet: jcDroletScraper,
  refrabec: refrabecScraper,
  "amenagementgrenon-com": amenagementGrenonScraper,
  guay: guayScraper,
  cafortier: cafortierScraper,
  canam: canamScraper,
  "groupe-canam-duplicate": groupeCanamDuplicateScraper,
  revenco: revencoScraper,
  "lescharpentistes-com": lescharpentistesScraper,
  "stefetmax-com": stefetmaxScraper,
  "droletconstruction-com": droletConstructionScraper,
  "electricitemc2-com": electriciteMc2Scraper,
  glr: glrScraper,
  "excavationsrsr-com": excavationsRsrScraper,
  galilee: galileeScraper,
  intermat: intermatScraper,
  rioux: riouxScraper,
  "atkinsrealis-com": atkinsRealisScraper,
  "arteliagroup-com": arteliaScraper,
  "ascenseurs-absolu": ascenseursAbsoluScraper,
  atelierenhauteur: atelierEnHauteurScraper,
  "atlas-apex": atlasApexScraper,
  "audetentrepreneurpeintre-com": audetEntrepreneurPeintreScraper,
  "automationdrummond-com": automationDrummondScraper,
  "avivia-ca": aviviaScraper,
  "bardeaux-ca": bardeauxScraper,
  "barettebernard-com": baretteBernardScraper,
  "qmb-ca": qmbScraper,
  "gestionagodin-com": gestionAgodinScraper,
  "baulne-ca": baulneScraper,
  "berardtremblay-com": berardTremblayScraper,
  "constructionjrsavard-ca": constructionJrsavardScraper,
  "bertrandostiguy-ca": bertrandOstiguyScraper,
  "betonbarrette-qc-ca": betonBarretteScraper,
  "brunet-cc": brunetScraper,
  "betonfondationplus-com": betonFondationPlusScraper,
  "betonsurface-ca": betonSurfaceScraper,
  "bousada-com": bousadaScraper,
  "betongl-com": betonGlScraper,
  "bellemare-njoyn": bellemareScraper,
  "groupebellemare-com": groupebellemareScraper,
} satisfies Record<CustomScraperId, Scraper>;

/**
 * Registre des scrapers branchés. La clé est l'`id` de l'employeur dans
 * `discovered.json`. Les sources désactivées (`enabled === false`) ne sont pas
 * branchées. Chaque employeur utilise son scraper bespoke s'il en a un, sinon le
 * scraper générique construit à partir de sa méthode.
 */
export const SCRAPERS: Record<string, Scraper> = Object.fromEntries(
  DISCOVERED_EMPLOYERS.filter((d) => d.enabled !== false).map((d) => [
    d.id,
    bespokeScraper(d.id) ?? buildDiscoveredScraper(d),
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
  return CUSTOM_SCRAPER_IDS.includes(id as CustomScraperId) ? BESPOKE[id as CustomScraperId] : undefined;
}

export function listScraperIds(): string[] {
  return Object.keys(SCRAPERS);
}
