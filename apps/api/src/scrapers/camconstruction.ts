import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * Construction Alain Morin inc. (CAM) — page WordPress `/carriere/`.
 * Les postes ouverts sont des accordéons Bootstrap (`.accordion-item`) :
 * titre dans `.accordion-button`, détail dans `.accordion-body`.
 * Pas de fiche dédiée : ancre `#slug`. Le lien « Postuler » mène à `#postuler`.
 */
const ID = "camconstruction-ca";
const COMPANY = "Construction Alain Morin inc.";
const CAREERS_URL = "https://camconstruction.ca/carriere/";
const LOCATION = "Windsor, QC";

function textFromHtml(html: string): string {
  const withBreaks = html
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h[1-6]|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  return cleanText(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/\s*\n\s*/g, "\n")
    .replace(/^postuler$/gim, "")
    .trim();
}

/** Parseur PUR : accordéons « Nos postes disponibles » → offres. */
export function parseCamConstruction(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const base = baseUrl.split("#")[0]!.replace(/\/+$/, "") + "/";
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  const $items = $(".block-jobs .accordion-item");
  ($items.length ? $items : $(".accordion-item")).each((_, el) => {
    const $item = $(el);
    const title = cleanText(
      $item.find(".accordion-button").first().text() ||
        $item.find("a.apply-form").attr("data-job-title") ||
        "",
    );
    if (!title || title.length < 3) return;

    const url = `${base}#${slugify(title)}`;
    if (seen.has(url)) return;
    seen.add(url);

    const descHtml = $item.find(".accordion-body").first().html() ?? "";
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

export const camConstructionScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseCamConstruction(html, baseUrl || CAREERS_URL),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL);
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseCamConstruction(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
