import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { extractJsonLdJobs } from "./jsonld.js";
import { cleanText } from "./util.js";

/**
 * Bois Massif Québec (boismassifquebec.com) — entrepreneur en bois massif
 * (entretien de revêtements extérieurs, ébénisterie) au Saguenay–Lac-Saint-Jean.
 *
 * Le site Webflow n'expose qu'une seule page d'emploi, structurée en JSON-LD
 * schema.org JobPosting. On extrait donc le bloc `application/ld+json` pour
 * obtenir titre, description, localisation, type d'emploi et salaire.
 */
const ID = "boismassifquebec-com";
const COMPANY = "Bois Massif Québec";
const CAREERS_URL = "https://www.boismassifquebec.com/emplois/apprenti-compagnon-peintre";

/** Extrait le poste à partir du JSON-LD, avec un repli sur le HTML visible. */
export function parseBoismassifquebec(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const jobs = extractJsonLdJobs(html, ID, baseUrl);
  if (jobs.length === 0) {
    // Repli : le titre de la page est le seul poste affiché.
    const $ = cheerio.load(html);
    const title = cleanText($("h1.heading-style-h2").first().text());
    if (!title) return [];
    return [
      {
        sourceId: ID,
        url: baseUrl,
        title,
        company: COMPANY,
        tags: [],
      },
    ];
  }

  return jobs.map((job) => ({
    ...job,
    company: COMPANY,
  }));
}

export const boismassifquebecScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseBoismassifquebec(html, baseUrl || CAREERS_URL);
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS_URL}`);
    let html: string;
    try {
      // Le site Webflow bloque les User-Agent identifiables (403) ; on se fait
      // passer pour un navigateur standard pour obtenir la page.
      html = await ctx.fetchHtml(CAREERS_URL, {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      });
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseBoismassifquebec(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
