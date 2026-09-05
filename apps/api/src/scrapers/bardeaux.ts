import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { ScrapeContext, ScrapeParams, Scraper } from "./types.js";
import { cleanText } from "./util.js";

/**
 * Bardeaux.ca (toiture, Trois-Rivières) — page **mono-poste** : une seule fiche
 * « Emploi couvreur ». Le repli générique n'y voit rien d'exploitable, donc on
 * émet le poste unique quand la page le mentionne encore (sinon on signale
 * l'absence pour purge). Le titre vient du H1 (« emploi couvreur » → « Couvreur »).
 */
const ID = "bardeaux-ca";
const COMPANY = "Bardeaux";
const CAREERS = "https://bardeaux.ca/emploi-couvreur/";
const LOCATION = "Trois-Rivières, QC";

export function parseBardeaux(html: string, url = CAREERS): RawJob[] {
  const $ = cheerio.load(html);
  const h1 = cleanText($("h1").first().text());
  // Le poste n'est plus affiché → aucune offre (permet la purge).
  if (!/couvreur/i.test(`${h1} ${cleanText($("body").text()).slice(0, 4000)}`)) return [];
  let title = h1.replace(/^\s*emplois?\s+(?:de\s+)?/i, "").trim();
  if (!title) title = "couvreur";
  title = title.charAt(0).toUpperCase() + title.slice(1);
  return [
    {
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      location: LOCATION,
      employmentType: "temps-plein",
    },
  ];
}

export const bardeauxScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseBardeaux(html, baseUrl || CAREERS),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS);
    } catch (err) {
      ctx.log(`${ID} — échec : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseBardeaux(html, CAREERS);
    if (jobs.length === 0 && html.length > 2000) ctx.markNoOpenings?.(false);
    ctx.log(`${ID} — ${jobs.length} poste(s)`);
    return jobs;
  },
};
