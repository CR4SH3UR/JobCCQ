import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * Chauffage M.C. (2007) inc. — page `/carriere` (CMS ADN).
 * Chaque poste est un accordéon `.toggle` : titre en `h2.toggle__title`,
 * exigences / avantages dans `.toggle__content`. Pas d'URL propre : ancre `#slug`.
 */
const ID = "chauffagemc-com";
const COMPANY = "Chauffage M.C. (2007) inc.";
const CAREERS_URL = "https://www.chauffagemc.ca/carriere";
const LOCATION = "Hérouxville, QC";

const NOT_A_JOB = /^(offre d['’]emplois?|carri[eè]re|nous joindre|avantages|recherche)$/i;

function textFromHtml(html: string): string {
  const withBreaks = html
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h[1-6]|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  return cleanText(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Parseur PUR : volets `.toggle` → offres. */
export function parseChauffageMc(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const base = baseUrl.split("#")[0]!;
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $(".toggle").each((_, el) => {
    const $item = $(el);
    const title = cleanText($item.find("h2.toggle__title").first().text());
    if (!title || title.length < 3 || NOT_A_JOB.test(title)) return;

    const url = `${base}#${slugify(title)}`;
    if (seen.has(url)) return;
    seen.add(url);

    const descHtml = $item.find(".toggle__content").first().html() ?? "";
    const description = textFromHtml(descHtml);

    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      location: LOCATION,
      description: description || undefined,
      tags: [],
    });
  });

  return jobs;
}

export const chauffageMcScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseChauffageMc(html, baseUrl || CAREERS_URL),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL);
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseChauffageMc(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
