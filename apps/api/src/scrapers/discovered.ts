import { type DiscoveredEmployer } from "@jobccq/shared";
import type { Scraper } from "./types.js";
import { makeCareersScraper } from "./careers.js";
import { makeZohoRecruitScraper } from "./zoho-recruit.js";
import { makeBambooHrScraper } from "./bamboohr.js";
import { makeAtsJsonScraper, type AtsPlatform } from "./ats-json.js";
import { makeJobillicoEmployerScraper } from "./jobillico-employer.js";
import { makeUltiProScraper } from "./ultipro.js";
import { makeJackStaffScraper } from "./jackstaff.js";

/** Extrait le handle (jeton/sous-domaine) d'un employeur depuis l'URL de son ATS. */
const atsHandle = (platform: AtsPlatform, url: string, fallback: string): string => {
  const pat: Record<AtsPlatform, RegExp> = {
    greenhouse: /greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/i,
    lever: /jobs\.lever\.co\/([a-z0-9_-]+)/i,
    recruitee: /\/\/([a-z0-9-]+)\.recruitee\.com/i,
    smartrecruiters: /smartrecruiters\.com\/([a-z0-9-]+)/i,
    teamtailor: /\/\/([a-z0-9-]+)\.teamtailor\.com/i,
  };
  return url.match(pat[platform])?.[1] ?? fallback;
};

/**
 * Scrapers des employeurs **auto-découverts** (registre RBQ, data-driven :
 * packages/shared/src/discovered.json). Chaque entrée est routée vers le
 * scraper réutilisable adapté à la méthode détectée. La majorité sont de
 * simples pages carrières (repli « titres ») ; certains passent par l'API
 * JSON d'un ATS (Zoho, BambooHR, Greenhouse, Lever, Recruitee, SmartRecruiters)
 * ou par une page employeur Jobillico.
 */
/** Une URL de page employeur Jobillico (fiche entreprise ou liste d'emplois). */
const isJobillicoEmployerUrl = (url: string): boolean =>
  /jobillico\.com\/(?:[a-z]{2}\/)?(?:voir-entreprise|employeurs)\//i.test(url) ||
  /jobillico\.com\/.*voir-liste-emplois/i.test(url);

/** Construit le scraper adapté à un employeur découvert selon sa méthode. */
export function buildDiscoveredScraper(d: DiscoveredEmployer): Scraper {
  // Garde-fou : une page employeur Jobillico se parse TOUJOURS avec le parseur
  // Jobillico, même si la méthode a été mal réglée (« html »). Sinon la page
  // générique récupère la navigation du site (« Emplois à Toronto », « Emplois
  // en vente »…) au lieu des vrais postes. Insensible à une config erronée.
  if (isJobillicoEmployerUrl(d.careersUrl)) {
    return makeJobillicoEmployerScraper({ id: d.id, company: d.name, listUrl: d.careersUrl });
  }
  if (d.method === "zoho") {
    // GLR (G.L.R. inc.) fait partie du groupe EBC et partage SON portail Zoho
    // (ebcinc.zohorecruit.com) : sans filtre, GLR hériterait des ~240 postes
    // d'EBC (doublon d'EBC, employeur séparé). On ne garde que ceux étiquetés
    // « (GLR) » dans l'intitulé.
    const titleFilter = d.id === "glr-qc-ca" ? /\(\s*GLR\s*\)/i : undefined;
    return makeZohoRecruitScraper({ id: d.id, company: d.name, careersUrl: d.careersUrl, titleFilter });
  }
  if (d.method === "bamboohr") {
    // careersUrl = https://<subdomain>.bamboohr.com
    const subdomain = d.careersUrl.match(/\/\/([a-z0-9-]+)\.bamboohr\.com/i)?.[1] ?? d.id;
    return makeBambooHrScraper({ id: d.id, company: d.name, subdomain });
  }
  if (
    d.method === "greenhouse" ||
    d.method === "lever" ||
    d.method === "recruitee" ||
    d.method === "smartrecruiters" ||
    d.method === "teamtailor"
  ) {
    const platform = d.method as AtsPlatform;
    const handle = atsHandle(platform, d.careersUrl, d.id);
    return makeAtsJsonScraper({ id: d.id, company: d.name, platform, handle });
  }
  if (d.method === "jobillico") {
    return makeJobillicoEmployerScraper({ id: d.id, company: d.name, listUrl: d.careersUrl });
  }
  if (d.method === "jackstaff") {
    return makeJackStaffScraper({ id: d.id, company: d.name, listUrl: d.careersUrl });
  }
  if (d.method === "ultipro") {
    // careersUrl = https://recruiting.ultipro.ca/<tenant>/JobBoard/<guid>/…
    const m = d.careersUrl.match(/ultipro\.ca\/([^/]+)\/JobBoard\/([0-9a-fA-F-]+)/);
    if (m) return makeUltiProScraper({ id: d.id, company: d.name, tenant: m[1]!, boardGuid: m[2]! });
  }
  // html / jsonld (et repli) → page carrières générique (JSON-LD → Wix → titres → liens).
  return makeCareersScraper({ id: d.id, company: d.name, careersUrl: d.careersUrl });
}
