import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText } from "./util.js";

/**
 * Portail carrières **SAP SuccessFactors Recruiting Marketing**
 * (`*.successfactors.com` / domaines `carriere.*`). Les tuiles `li.job-tile`
 * exposent le titre (`a.jobTitle-link`) et la ville (champ `city`).
 */
export interface SuccessFactorsConfig {
  id: string;
  company: string;
  /** Origine du portail, ex. https://carriere.ccq.org */
  origin: string;
  /** Plafond de pages (25 offres / page par défaut SF). */
  maxPages?: number;
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const PAGE_SIZE = 25;

/** Parse une page de résultats SuccessFactors (tuiles `li.job-tile`). */
export function parseSuccessFactors(html: string, cfg: SuccessFactorsConfig): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $("li.job-tile").each((_, el) => {
    const $el = $(el);
    const $a = $el.find("a.jobTitle-link").first();
    const href = $a.attr("href") || $el.attr("data-url") || "";
    if (!href) return;
    const url = absolute(cfg.origin, href.split("?")[0] ?? href);
    if (seen.has(url)) return;
    const title = cleanText($a.text());
    if (!title) return;
    const city = cleanText($el.find('[id$="-desktop-section-city-value"]').first().text())
      || cleanText($el.find(".section-field.city").find("div").last().text());
    seen.add(url);
    jobs.push({
      sourceId: cfg.id,
      url,
      title,
      company: cfg.company,
      location: city || undefined,
      tags: [],
    });
  });

  return jobs;
}

export function makeSuccessFactorsScraper(cfg: SuccessFactorsConfig): Scraper {
  const maxPages = cfg.maxPages ?? 4;
  return {
    id: cfg.id,
    parseList(html: string): RawJob[] {
      return parseSuccessFactors(html, cfg);
    },
    async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
      const all = new Map<string, RawJob>();
      for (let page = 0; page < maxPages; page++) {
        const url = `${cfg.origin.replace(/\/+$/, "")}/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow=${page * PAGE_SIZE}`;
        ctx.log(`${cfg.id} — SuccessFactors p.${page + 1} : ${url}`);
        let html: string;
        try {
          html = await ctx.fetchHtml(url, { userAgent: BROWSER_UA });
        } catch (err) {
          ctx.log(`${cfg.id} — échec : ${(err as Error).message}`);
          break;
        }
        const batch = parseSuccessFactors(html, cfg);
        for (const j of batch) all.set(j.url, j);
        if (batch.length < PAGE_SIZE) break;
      }
      ctx.log(`${cfg.id} — ${all.size} poste(s) trouvé(s)`);
      return [...all.values()];
    },
  };
}
