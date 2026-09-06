import { isCcqTrade } from "@jobccq/shared";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { makeSuccessFactorsScraper, parseSuccessFactors } from "./successfactors.js";

/**
 * Source **CCQ** — portail carrières public (SuccessFactors, carriere.ccq.org).
 *
 * Le « Carrefour construction » a été remplacé par le **Carnet référence
 * construction**, un service de matching qui exige un compte travailleur /
 * employeur. On ne le scrape pas (pas d'offres publiques). On importe plutôt
 * les postes **publics** de la Commission, en ne gardant que ceux liés à
 * l'industrie (métiers CCQ, qualification, chantier, bâtiments…).
 */
export const CCQ_CAREERS_ORIGIN = "https://carriere.ccq.org";
export const CCQ_COMPANY = "Commission de la construction du Québec";

const INDUSTRY_RE =
  /chantier|inspecteur|pr[ée]vention|qualification|r[ée]f[ée]rence|m[ée]tier|coffrage|b[aâ]timent|construction|formation professionnelle|convention collective|main[- ]d.?œuvre|rbq/i;

/** Titre d'un poste CCQ pertinent pour JobCCQ (métier ou organe de l'industrie). */
export function isCcqIndustryTitle(title: string): boolean {
  return isCcqTrade(title) || INDUSTRY_RE.test(title);
}

const sf = makeSuccessFactorsScraper({
  id: "ccq-construction",
  company: CCQ_COMPANY,
  origin: CCQ_CAREERS_ORIGIN,
});

export function parseCcqConstruction(html: string, baseUrl = CCQ_CAREERS_ORIGIN): RawJob[] {
  return parseSuccessFactors(html, {
    id: "ccq-construction",
    company: CCQ_COMPANY,
    origin: baseUrl,
  }).filter((j) => isCcqIndustryTitle(j.title));
}

export const ccqConstructionScraper: Scraper = {
  id: "ccq-construction",
  parseList: parseCcqConstruction,
  async scrape(params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    const raw = await sf.scrape(params, ctx);
    const jobs = raw.filter((j) => isCcqIndustryTitle(j.title));
    ctx.log(`ccq-construction — ${jobs.length} poste(s) industrie (sur ${raw.length})`);
    if (raw.length > 0 && jobs.length === 0) {
      ctx.log("ccq-construction — portail joignable, aucun poste chantier/qualification");
    }
    return jobs;
  },
};
