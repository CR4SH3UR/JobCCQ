import { DISCOVERED_EMPLOYERS } from "@jobccq/shared";
import type { Scraper } from "./types.js";
import { makeCareersScraper } from "./careers.js";
import { makeZohoRecruitScraper } from "./zoho-recruit.js";
import { makeBambooHrScraper } from "./bamboohr.js";
import { makeAtsJsonScraper, type AtsPlatform } from "./ats-json.js";
import { makeJobillicoEmployerScraper } from "./jobillico-employer.js";

/** Extrait le handle (jeton/sous-domaine) d'un employeur depuis l'URL de son ATS. */
const atsHandle = (platform: AtsPlatform, url: string, fallback: string): string => {
  const pat: Record<AtsPlatform, RegExp> = {
    greenhouse: /greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/i,
    lever: /jobs\.lever\.co\/([a-z0-9_-]+)/i,
    recruitee: /\/\/([a-z0-9-]+)\.recruitee\.com/i,
    smartrecruiters: /smartrecruiters\.com\/([a-z0-9-]+)/i,
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
export const discoveredScrapers: Record<string, Scraper> = Object.fromEntries(
  DISCOVERED_EMPLOYERS.map((d) => {
    if (d.method === "zoho") {
      return [d.id, makeZohoRecruitScraper({ id: d.id, company: d.name, careersUrl: d.careersUrl })];
    }
    if (d.method === "bamboohr") {
      // careersUrl = https://<subdomain>.bamboohr.com
      const subdomain = (d.careersUrl.match(/\/\/([a-z0-9-]+)\.bamboohr\.com/i)?.[1] ?? d.id);
      return [d.id, makeBambooHrScraper({ id: d.id, company: d.name, subdomain })];
    }
    if (
      d.method === "greenhouse" ||
      d.method === "lever" ||
      d.method === "recruitee" ||
      d.method === "smartrecruiters"
    ) {
      const platform = d.method as AtsPlatform;
      const handle = atsHandle(platform, d.careersUrl, d.id);
      return [d.id, makeAtsJsonScraper({ id: d.id, company: d.name, platform, handle })];
    }
    if (d.method === "jobillico") {
      return [d.id, makeJobillicoEmployerScraper({ id: d.id, company: d.name, listUrl: d.careersUrl })];
    }
    // html / jsonld → page carrières générique (JSON-LD → Wix → titres → liens).
    return [d.id, makeCareersScraper({ id: d.id, company: d.name, careersUrl: d.careersUrl })];
  }),
);
