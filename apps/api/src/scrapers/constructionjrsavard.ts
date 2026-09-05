import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText } from "./util.js";

/**
 * Construction J&R Savard (constructionjrsavard.ca) — génie civil / carrière /
 * transport au Saguenay–Lac-Saint-Jean.
 *
 * Les offres sont présentées dans des blocs `.jobOffer-block` contenant un
 * titre `<h3>` et un lien `<a class="link-overflow">`. La pagination se fait
 * par `?page=N`. On arrête dès qu'une page n'apporte plus de nouvelles offres.
 */
const ID = "constructionjrsavard-ca";
const COMPANY = "Construction J&R Savard";
const BASE_URL = "https://constructionjrsavard.ca/carriere";

// Le serveur Webrio renvoie 405 à certains User-Agents « bot » ; on présente un
// navigateur classique.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

/** Parse une page de listing en offres. */
export function parseJrsavard(html: string): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $(".sect-job-offers .jobOffer-block").each((_, block) => {
    const $block = $(block);
    const title = cleanText($block.find("h3").first().text());
    if (!title) return;

    const href = $block.find("a.link-overflow").first().attr("href");
    if (!href) return;

    const url = href.startsWith("http") ? href : `https://constructionjrsavard.ca${href.startsWith("/") ? "" : "/"}${href}`;
    if (seen.has(url)) return;
    seen.add(url);

    jobs.push({ sourceId: ID, url, title, company: COMPANY, tags: [] });
  });

  return jobs;
}

function pageUrl(page: number): string {
  return page === 1 ? BASE_URL : `${BASE_URL}?page=${page}`;
}

export const constructionJrsavardScraper: Scraper = {
  id: ID,
  parseList(html: string): RawJob[] {
    return parseJrsavard(html);
  },
  async scrape(params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    const maxPages = Math.max(1, params.maxPages ?? 5);
    const all = new Map<string, RawJob>();

    for (let page = 1; page <= maxPages; page++) {
      const url = pageUrl(page);
      ctx.log(`${ID} — page ${page} : ${url}`);
      let html: string;
      try {
        html = await ctx.fetchHtml(url, { userAgent: BROWSER_UA });
      } catch (err) {
        ctx.log(`${ID} — échec page ${page} : ${(err as Error).message}`);
        if (page === 1) return [];
        break;
      }
      const found = parseJrsavard(html);
      let fresh = 0;
      for (const job of found) {
        if (!all.has(job.url)) {
          all.set(job.url, job);
          fresh++;
        }
      }
      ctx.log(`${ID} — page ${page} : ${found.length} offre(s), ${fresh} nouvelle(s)`);
      if (found.length === 0 || fresh === 0) break;
    }

    const jobs = [...all.values()];
    if (jobs.length === 0) ctx.markNoOpenings?.();
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    return jobs;
  },
};
