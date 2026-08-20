import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText, parseFrenchDate } from "./util.js";

const BASE = "https://www.guichetemplois.gc.ca";
const SOURCE_ID = "guichet-emplois";

/** Retire `;jsessionid=…` et les paramètres pour un identifiant d'offre stable. */
function cleanJobUrl(href: string): string {
  const noSession = href.split(";")[0]!;
  const noQuery = noSession.split("?")[0]!;
  return absolute(BASE, noQuery);
}

function remoteFromFlag(text: string): RawJob["remote"] {
  const t = text.toLowerCase();
  if (/hybride/.test(t)) return "hybride";
  if (/télétravail|teletravail|à distance|a distance/.test(t)) return "teletravail";
  if (/sur place|en personne/.test(t)) return "presentiel";
  return undefined;
}

/**
 * Parse une page de résultats du Guichet-Emplois.
 * Chaque offre est une ancre `a.resultJobItem` contenant titre, entreprise,
 * lieu, date et (souvent) le salaire.
 */
export function parseList(html: string, baseUrl = BASE): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $("a.resultJobItem").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href");
    if (!href) return;
    const url = cleanJobUrl(href);
    if (seen.has(url)) return;

    const title = cleanText($el.find(".noctitle").first().text());
    const company = cleanText($el.find(".business").first().text());
    if (!title || !company) return;

    const location = cleanText($el.find(".location").first().text()).replace(
      /^Emplacement\s*/i,
      "",
    );
    const salaryText = cleanText($el.find(".salary").first().text());
    const flag = cleanText($el.find(".telework").first().text());
    const dateText = cleanText($el.find(".date").first().text());

    seen.add(url);
    jobs.push({
      sourceId: SOURCE_ID,
      url,
      title,
      company,
      location: location || undefined,
      remote: remoteFromFlag(flag),
      // Le salaire (« Salaire : 22 $ à 25 $ de l'heure ») est extrait par le
      // normaliseur depuis la description.
      description: salaryText || undefined,
      postedAt: parseFrenchDate(dateText),
      tags: [],
    });
  });

  return jobs;
}

export const guichetEmploisScraper: Scraper = {
  id: SOURCE_ID,
  parseList,
  async scrape(params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    const maxPages = params.maxPages ?? 3;
    const kw = params.query ? encodeURIComponent(params.query) : "";
    const loc = encodeURIComponent(params.location ?? "Québec");
    const all = new Map<string, RawJob>();

    for (let page = 1; page <= maxPages; page++) {
      const url = `${BASE}/jobsearch/jobsearch?searchstring=${kw}&locationstring=${loc}&sort=D&page=${page}`;
      ctx.log(`Guichet-Emplois — page ${page} : ${url}`);
      let html: string;
      try {
        html = await ctx.fetchHtml(url);
      } catch (err) {
        ctx.log(`Guichet-Emplois — arrêt page ${page} : ${(err as Error).message}`);
        break;
      }
      const found = parseList(html, url);
      ctx.log(`Guichet-Emplois — ${found.length} offres sur la page ${page}`);
      if (found.length === 0) break;
      let fresh = 0;
      for (const job of found) if (!all.has(job.url)) (all.set(job.url, job), fresh++);
      if (fresh === 0) break;
    }

    return [...all.values()];
  },
};
