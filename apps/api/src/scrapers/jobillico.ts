import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { extractJsonLdJobs } from "./jsonld.js";

const BASE = "https://www.jobillico.com";
const SOURCE_ID = "jobillico";

function absolute(href: string): string {
  if (href.startsWith("http")) return href;
  return `${BASE}${href.startsWith("/") ? "" : "/"}${href}`;
}

/**
 * Repli HTML : on parcourt les liens vers les fiches d'offres et on remonte
 * la carte pour en extraire l'entreprise et la localisation.
 * (Sélecteurs indicatifs — à ajuster contre le DOM réel de Jobillico.)
 */
function parseHtmlCards(html: string): RawJob[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const jobs: RawJob[] = [];

  $('a[href*="/offre-emploi/"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const url = absolute(href.split("?")[0]!);
    if (seen.has(url)) return;

    const title = $(el).text().trim() || $(el).attr("title")?.trim() || "";
    if (!title || title.length < 3) return;

    // La carte est un ancêtre proche du lien.
    const card = $(el).closest("article, li, .job, .jobEntry, .search-result, [class*='job']");
    const company =
      card.find("[class*='company'], [class*='entreprise'], [itemprop='hiringOrganization']").first().text().trim() ||
      card.find("h3, h4").eq(1).text().trim();
    const location = card
      .find("[class*='location'], [class*='lieu'], [class*='ville'], [itemprop='jobLocation']")
      .first()
      .text()
      .trim();

    if (!company) return; // sans entreprise, la carte est probablement du bruit

    seen.add(url);
    jobs.push({
      sourceId: SOURCE_ID,
      url,
      title,
      company,
      location: location || undefined,
      tags: [],
    });
  });

  return jobs;
}

export const jobillicoScraper: Scraper = {
  id: SOURCE_ID,

  parseList(html: string, baseUrl: string): RawJob[] {
    // 1) JSON-LD (le plus fiable), 2) repli sur les cartes HTML.
    const jsonld = extractJsonLdJobs(html, SOURCE_ID, baseUrl);
    if (jsonld.length > 0) return jsonld;
    return parseHtmlCards(html);
  },

  async scrape(params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    const maxPages = params.maxPages ?? 3;
    const kw = params.query ? encodeURIComponent(params.query) : "";
    const loc = params.location ? encodeURIComponent(params.location) : "";
    const all = new Map<string, RawJob>();

    for (let page = 1; page <= maxPages; page++) {
      const url = `${BASE}/fr/recherche-emploi?skwd=${kw}&sloc=${loc}&page=${page}`;
      ctx.log(`Jobillico — page ${page} : ${url}`);
      let html: string;
      try {
        html = await ctx.fetchHtml(url);
      } catch (err) {
        ctx.log(`Jobillico — arrêt page ${page} : ${(err as Error).message}`);
        break;
      }
      const found = this.parseList!(html, url);
      ctx.log(`Jobillico — ${found.length} offres sur la page ${page}`);
      if (found.length === 0) break; // plus de résultats
      for (const job of found) all.set(job.url, job);
    }

    return [...all.values()];
  },
};
