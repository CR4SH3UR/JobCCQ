import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText } from "./util.js";

/**
 * Automation Drummond inc. (automationdrummond.com/emplois/) — WordPress.
 *
 * Les vrais postes sont des paragraphes « titre en gras + une ligne + [Voir le
 * poste] ». Le scraper générique rate le Panelier : l'URL est un slug emoji
 * (`/🔧-panelier-…`) qui ne matche pas emploi/poste/offre, et le titre n'est
 * pas un titre HTML. On parse uniquement `.entry-content` pour ignorer le menu
 * (mêmes liens, intitulés différents).
 */
const ID = "automationdrummond-com";
const COMPANY = "Automation Drummond inc.";
const CAREERS = "https://automationdrummond.com/emplois/";
const LOCATION = "Victoriaville, QC";

const CTA = /voir\s+le\s+poste/i;

export function parseAutomationDrummond(html: string, baseUrl = CAREERS): RawJob[] {
  const $ = cheerio.load(html);
  const $content = $(".entry-content");
  const $links = $content.length ? $content.find("a[href]") : $("a[href]");
  const out = new Map<string, RawJob>();

  $links.each((_, el) => {
    const $a = $(el);
    if (!CTA.test(cleanText($a.text()))) return;
    const href = ($a.attr("href") ?? "").trim();
    if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) return;

    const url = absolute(baseUrl, href.split("#")[0] ?? href);
    if (out.has(url)) return;

    const $p = $a.closest("p");
    const title = cleanText($p.find("strong, b").first().text());
    if (!title || title.length < 3) return;

    const $clone = $p.clone();
    $clone.find("a, strong, b, img").remove();
    const description = cleanText($clone.text().replace(/👉/g, " "));

    out.set(url, {
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      location: LOCATION,
      ...(description ? { description } : {}),
      tags: [],
    });
  });

  return [...out.values()];
}

export const automationDrummondScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseAutomationDrummond(html, baseUrl || CAREERS);
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS);
    } catch (err) {
      ctx.log(`${ID} — échec : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseAutomationDrummond(html, CAREERS);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.(false);
    return jobs;
  },
};
