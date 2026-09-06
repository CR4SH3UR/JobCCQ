import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * Champlain Métal (2001) inc. — page WordPress / Elementor `/carrieres/`.
 * Chaque poste est un volet d'accordéon (`.elementor-accordion-item`) : le
 * titre est dans `a.elementor-accordion-title`, la description dans le
 * premier bloc texte du volet. Pas d'URL propre : ancre `#slug`.
 */
const ID = "champlainmetal-com";
const COMPANY = "Champlain Métal (2001) inc.";
const CAREERS_URL = "https://champlainmetal.com/carrieres/";
const LOCATION = "Montréal";

const NOT_A_JOB = /^(description de t[aâ]che|comp[eé]tences|avantages|postes offerts|postuler)$/i;

function textFromHtml(html: string): string {
  const withBreaks = html
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h[1-6]|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  return cleanText(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Parseur PUR : accordéon Elementor → offres. */
export function parseChamplainMetal(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const base = baseUrl.split("#")[0]!;
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $(".elementor-accordion-item").each((_, el) => {
    const $item = $(el);
    const title = cleanText($item.find("a.elementor-accordion-title").first().text());
    if (!title || title.length < 3 || NOT_A_JOB.test(title)) return;

    const url = `${base}#${slugify(title)}`;
    if (seen.has(url)) return;
    seen.add(url);

    const descHtml = $item.find(".elementor-tab-content .elementor-widget-text-editor").first().html() ?? "";
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

export const champlainMetalScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseChamplainMetal(html, baseUrl || CAREERS_URL),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL);
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseChamplainMetal(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
