import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText } from "./util.js";

/**
 * Groupe Camille Blais & Fils Ltée (gcbfinc.com) — La Famille CBF.
 *
 * La page carrière WordPress affiche les postes disponibles sous forme de
 * blocs `.offre_title_btn`. Chaque bloc contient un lien `.link_offre` :
 *   - le titre du poste dans `.title_offre`
 *   - un bouton décoratif « En savoir plus » dans `.btn_filter_offres`
 *   - l'URL de l'offre dans l'attribut `href` du lien
 */
const ID = "gcbfinc-com";
const COMPANY = "La Famille CBF";
const CAREERS_URL = "https://gcbfinc.com/carriere/";

/** Parse la page carrière de GCBF et retourne une offre par bloc trouvé. */
export function parseGcbfinc(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $(".offre_title_btn .link_offre[href]").each((_, element) => {
    const $link = $(element);

    const title = cleanText($link.find(".title_offre").first().text());
    if (!title || title.length < 3) return;

    const href = ($link.attr("href") ?? "").trim();
    if (!href) return;

    const url = absolute(baseUrl, href).split("#")[0];
    if (!url || seen.has(url)) return;

    seen.add(url);
    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      tags: [],
    });
  });

  return jobs;
}

export const gcbfincScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseGcbfinc(html, baseUrl || CAREERS_URL);
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL);
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseGcbfinc(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
