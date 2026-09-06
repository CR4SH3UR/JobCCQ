import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText } from "./util.js";

/**
 * Carrier Canada Corporation — portail TalentBrew (jobs.carrier.com).
 * La liste Canada est paginée (`…/6251999/2` puis `…/2/2`, 10 offres / page).
 * JobCCQ ne retient que les postes au Québec (lieu « QC » / « Québec »).
 */
const ID = "carrier-com";
const COMPANY = "Carrier Canada Corporation";
const CAREERS_URL = "https://jobs.carrier.com/fr/lieu/canada-jobs/29289/6251999/2";
const MAX_PAGES = 10;
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const QC_LOCATION = /,\s*QC\b|\bqu[eé]bec\b/i;

function listPageUrl(page: number): string {
  return page <= 1 ? CAREERS_URL : `${CAREERS_URL}/${page}`;
}

function cleanLocation(raw: string): string | undefined {
  const text = cleanText(raw.replace(/^LOC\d+\s*:?\s*/i, ""));
  return text || undefined;
}

function isQuebecLocation(location: string | undefined): boolean {
  return !!location && QC_LOCATION.test(location);
}

function totalPagesFrom(html: string): number {
  const n = Number(html.match(/data-total-pages="(\d+)"/i)?.[1]);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(MAX_PAGES, n);
}

/** Parseur PUR : une page TalentBrew → offres Québec. */
export function parseCarrier(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $("a[data-job-id]").each((_, el) => {
    const $a = $(el);
    const href = ($a.attr("href") ?? "").trim();
    const title = cleanText($a.find("h2").first().text());
    if (!href || !/\/(job|emploi)\//i.test(href) || !title) return;
    const url = absolute(baseUrl.split("#")[0]!, href.split("?")[0]!);
    if (seen.has(url)) return;
    const location = cleanLocation($a.find(".job-location").first().text());
    if (!isQuebecLocation(location)) return;
    seen.add(url);
    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      location,
      tags: [],
    });
  });

  return jobs;
}

export const carrierScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseCarrier(html, baseUrl || CAREERS_URL),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    const byUrl = new Map<string, RawJob>();
    let pages = 1;
    for (let page = 1; page <= pages; page++) {
      const url = listPageUrl(page);
      ctx.log(`${ID} — page ${page} : ${url}`);
      let html: string;
      try {
        html = await ctx.fetchHtml(url, { userAgent: BROWSER_UA });
      } catch (err) {
        ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
        if (page === 1) return [];
        break;
      }
      if (page === 1) pages = totalPagesFrom(html);
      for (const job of parseCarrier(html, url)) {
        if (!byUrl.has(job.url)) byUrl.set(job.url, job);
      }
    }
    const jobs = [...byUrl.values()];
    ctx.log(`${ID} — ${jobs.length} poste(s) Québec trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
