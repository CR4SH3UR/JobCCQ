import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, mapEmploymentType, parseFrenchDate } from "./util.js";
import { htmlToText } from "./jsonld.js";

/**
 * Groupe Brunet (brunet.cc) — signalisation routière, béton et produits connexes.
 *
 * La page carrières utilise WP Job Manager, dont les offres sont chargées en AJAX.
 * Heureusement, le plugin expose un flux RSS dédié (`?feed=job_feed`) qui contient
 * toutes les offres actives avec leurs métadonnées (lieu, type de poste, date…).
 * On parse ce flux via les namespaces `job_listing:location` et `job_listing:job_type`.
 */
const ID = "brunet-cc";
const COMPANY = "Groupe Brunet";
const FEED_URL = "https://brunet.cc/?feed=job_feed&job_types=&search_location=&job_categories=&search_keywords=&author=";

/** Extrait les offres du flux RSS WP Job Manager de Brunet. */
export function parseBrunetFeed(xml: string, id: string, company: string): RawJob[] {
  const $ = cheerio.load(xml, { xml: true });
  const jobs: RawJob[] = [];

  $("item").each((_, el) => {
    const $it = $(el);
    const title = cleanText($it.find("title").first().text());
    const url = cleanText($it.find("link").first().text()).split("?")[0];
    if (!title || !url) return;

    const location = cleanText($it.find("job_listing\\:location").first().text()) || undefined;

    const jobTypeText = cleanText($it.find("job_listing\\:job_type").first().text());
    const typeParts = jobTypeText
      .split(/,\s*/)
      .map((t) => t.trim())
      .filter(Boolean);

    const employmentType = mapEmploymentType(typeParts.join(", "));
    const tags = typeParts.filter((t) => t.toLowerCase() !== "temps plein");

    const postedAt = parseFrenchDate($it.find("pubDate").first().text());
    const description = htmlToText($it.find("content\\:encoded").first().text(), 800);

    jobs.push({
      sourceId: id,
      url,
      title,
      company,
      location,
      employmentType,
      postedAt,
      description,
      tags,
    });
  });

  return jobs;
}

export const brunetScraper: Scraper = {
  id: ID,
  parseList(xml: string): RawJob[] {
    return parseBrunetFeed(xml, ID, COMPANY);
  },
  async scrape(params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    const maxPages = Math.max(1, params.maxPages ?? 8);
    const all = new Map<string, RawJob>();
    const sep = FEED_URL.includes("?") ? "&" : "?";

    for (let page = 1; page <= maxPages; page++) {
      const url = page === 1 ? FEED_URL : `${FEED_URL}${sep}paged=${page}`;
      ctx.log(`${ID} — flux page ${page} : ${url}`);
      let xml: string;
      try {
        xml = await ctx.fetchHtml(url);
      } catch (err) {
        ctx.log(`${ID} — arrêt page ${page} : ${(err as Error).message}`);
        break;
      }
      const found = parseBrunetFeed(xml, ID, COMPANY);
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
