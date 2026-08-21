import { DISCOVERED_EMPLOYERS } from "@jobccq/shared";
import type { Scraper } from "./types.js";
import { makeCareersScraper } from "./careers.js";
import { makeZohoRecruitScraper } from "./zoho-recruit.js";

/**
 * Scrapers des employeurs **auto-découverts** (registre RBQ, data-driven :
 * packages/shared/src/discovered.json). Chaque entrée est routée vers le
 * scraper réutilisable adapté à la méthode détectée. La majorité sont de
 * simples pages carrières (repli « titres »).
 */
export const discoveredScrapers: Record<string, Scraper> = Object.fromEntries(
  DISCOVERED_EMPLOYERS.map((d) => {
    if (d.method === "zoho") {
      return [d.id, makeZohoRecruitScraper({ id: d.id, company: d.name, careersUrl: d.careersUrl })];
    }
    // html / jsonld / (bamboohr, avature en repli) → page carrières générique.
    return [d.id, makeCareersScraper({ id: d.id, company: d.name, careersUrl: d.careersUrl })];
  }),
);
