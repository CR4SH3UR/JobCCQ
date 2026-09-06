import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText } from "./util.js";

/**
 * CHN inc. (chn-paysagiste.com) — page `/carriere`, section `#carriere-postes`.
 * Chaque carte a un `<h4>` (intitulé) et un lien « En savoir plus » vers
 * `/emplois/<slug>`. Le scrape générique prenait le libellé du lien, pas le titre.
 */
const ID = "chn-paysagiste-com";
const COMPANY = "CHN inc.";
const CAREERS_URL = "https://www.chn-paysagiste.com/carriere";
const LOCATION = "Saint-Jérôme, QC";

/** Parseur PUR : cartes « Postes disponibles » → offres. */
export function parseChnPaysagiste(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $('a[href*="/emplois/"]').each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href || /#/.test(href)) return;
    const url = absolute(baseUrl.split("#")[0]!, href.split("?")[0]!);
    if (seen.has(url)) return;

    const card = $(el).closest(".col, .grey-hover");
    const title = cleanText(card.find("h4").first().text());
    if (!title || title.length < 3) return;
    seen.add(url);

    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      location: LOCATION,
      tags: [],
    });
  });

  return jobs;
}

export const chnPaysagisteScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseChnPaysagiste(html, baseUrl || CAREERS_URL),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL);
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseChnPaysagiste(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
