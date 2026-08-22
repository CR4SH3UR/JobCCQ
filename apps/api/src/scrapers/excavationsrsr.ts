import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * Excavations R.S.R. (excavationsrsr.com/carriere/) — excavation / génie civil.
 *
 * Page WordPress/Elementor : les postes sont des **accordéons** Elementor
 * (`.e-n-accordion-item-title-text`). Le parseur générique les lit correctement,
 * mais la source restait vide en production : la récupération côté CI renvoyait
 * une page sans contenu (probable filtrage WAF/UA côté hébergeur). Ce scraper
 * sur mesure présente un **UA navigateur** et lit les titres d'accordéon.
 */
const ID = "excavationsrsr-com";
const COMPANY = "Excavations R.S.R. inc.";
const CAREERS_URL = "https://excavationsrsr.com/carriere/";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Intitulés d'accordéon qui ne sont pas des postes (sections génériques).
const NOT_A_JOB =
  /^(faq|questions?|nos\s+valeurs|avantages?|pourquoi|à\s+propos|contact|candidature\s+spontan)/i;

/** Parse les titres d'accordéon Elementor de la page carrières. */
export function parseExcavationsRsr(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const base = baseUrl.replace(/#.*$/, "").replace(/\/+$/, "");
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  const SEL = [
    ".e-n-accordion-item-title-text",
    ".e-n-accordion-item-title",
    ".elementor-accordion-title",
    ".elementor-tab-title",
  ].join(",");

  $(SEL).each((_, el) => {
    const title = cleanText($(el).text());
    if (!title || title.length < 3 || title.length > 90 || NOT_A_JOB.test(title)) return;
    const slug = slugify(title);
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    jobs.push({ sourceId: ID, url: `${base}/#${slug}`, title, company: COMPANY, tags: [] });
  });

  return jobs;
}

export const excavationsRsrScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseExcavationsRsr(html, baseUrl || CAREERS_URL);
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL, { userAgent: BROWSER_UA });
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseExcavationsRsr(html, CAREERS_URL);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    return jobs;
  },
};
