import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText } from "./util.js";

/**
 * CIMA+ (cima.ca) — liste SmartRecruiters rendue en HTML sur `/carrieres/`.
 * Chaque offre est une ligne `ul.jobLine` (titre, lieu, date). Pagination
 * `?pagination=N` (15 postes / page). On ne garde que le Québec.
 */
const ID = "cima-ca";
const COMPANY = "Cima + Construction inc.";
const CAREERS_URL = "https://www.cima.ca/carrieres/";
const MAX_PAGES = 30;
const QC_LOCATION = /,\s*QC\b|\bqu[eé]bec\b/i;
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function listPageUrl(page: number): string {
  return page <= 1 ? CAREERS_URL : `${CAREERS_URL}?noq=0&pagination=${page}`;
}

function postedAt(raw: string): string | undefined {
  const m = cleanText(raw).match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

function maxPageFrom(html: string): number {
  let max = 1;
  for (const m of html.matchAll(/[?&]pagination=(\d+)/gi)) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return Math.min(MAX_PAGES, max);
}

/** Parseur PUR : une page `/carrieres/` → offres Québec. */
export function parseCima(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $("ul.jobLine").each((_, el) => {
    const $line = $(el);
    const $a = $line.find("a.jobDetailLink").first();
    const href = ($a.attr("href") ?? "").trim();
    const title = cleanText($a.text());
    if (!href || !title) return;
    const location = cleanText($line.find(".jobLocation").first().text());
    if (location && !QC_LOCATION.test(location)) return;
    const url = absolute(baseUrl.split("#")[0]!, href);
    if (seen.has(url)) return;
    seen.add(url);
    const posted = postedAt($line.find(".jobDate").first().text());
    const sector = cleanText($line.find(".jobSector").first().text());
    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      location: location || undefined,
      ...(posted ? { postedAt: posted } : {}),
      tags: sector ? [sector] : [],
    });
  });

  return jobs;
}

export const cimaScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseCima(html, baseUrl || CAREERS_URL),
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
      if (page === 1) pages = maxPageFrom(html);
      for (const job of parseCima(html, url)) {
        if (!byUrl.has(job.url)) byUrl.set(job.url, job);
      }
    }
    const jobs = [...byUrl.values()];
    ctx.log(`${ID} — ${jobs.length} poste(s) Québec trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
