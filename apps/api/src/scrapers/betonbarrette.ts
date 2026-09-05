import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, parseFrenchDate } from "./util.js";

/**
 * Béton Barrette (betonbarrette.qc.ca) — béton, concassage et opérations en
 * Abitibi-Témiscamingue.
 *
 * Les offres sont publiées comme des articles WordPress dans la catégorie
 * « Offre d'emploi ». Le flux RSS de cette catégorie est le moyen le plus propre
 * de les lister : il expose titre, lien, date et catégories. Le titre est
 * systématiquement préfixé par « Offre d'emploi – », qu'on retire pour ne
 * garder que l'intitulé du poste.
 */
const ID = "betonbarrette-qc-ca";
const COMPANY = "Béton Barrette inc.";
const FEED_URL = "https://betonbarrette.qc.ca/category/offre-demploi/feed/";

const LEADING_LABEL = /^offre\s+d['\u2019]emploi\s*[-\u2013\u2014]\s*/i;

/** Parse le flux RSS de la catégorie « Offre d'emploi » en offres. */
export function parseBetonBarretteFeed(xml: string, id: string, company: string): RawJob[] {
  const $ = cheerio.load(xml, { xml: true });
  const jobs: RawJob[] = [];

  $("item").each((_, el) => {
    const $it = $(el);
    const rawTitle = cleanText($it.find("title").first().text());
    const title = rawTitle.replace(LEADING_LABEL, "").trim();
    const url = cleanText($it.find("link").first().text()).split("?")[0];
    if (!title || !url) return;

    const categories = $it
      .find("category")
      .map((_, c) => cleanText($(c).text()))
      .get()
      .filter((c) => c && c !== "Offre d'emploi");

    jobs.push({
      sourceId: id,
      url,
      title,
      company,
      postedAt: parseFrenchDate($it.find("pubDate").first().text()),
      tags: categories,
    });
  });

  return jobs;
}

export const betonBarretteScraper: Scraper = {
  id: ID,
  parseList(xml: string): RawJob[] {
    return parseBetonBarretteFeed(xml, ID, COMPANY);
  },
  async scrape(params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    const maxPages = Math.max(1, params.maxPages ?? 8);
    const all = new Map<string, RawJob>();

    for (let page = 1; page <= maxPages; page++) {
      const url = page === 1 ? FEED_URL : `${FEED_URL}?paged=${page}`;
      ctx.log(`${ID} — flux page ${page} : ${url}`);
      let xml: string;
      try {
        xml = await ctx.fetchHtml(url);
      } catch (err) {
        ctx.log(`${ID} — arrêt page ${page} : ${(err as Error).message}`);
        break;
      }
      const found = parseBetonBarretteFeed(xml, ID, COMPANY);
      let fresh = 0;
      for (const job of found) {
        if (!all.has(job.url)) {
          all.set(job.url, job);
          fresh++;
        }
      }
      ctx.log(`${ID} — page ${page} : ${found.length} items, ${fresh} nouveaux`);
      if (found.length === 0 || fresh === 0) break;
    }

    const jobs = [...all.values()];
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
