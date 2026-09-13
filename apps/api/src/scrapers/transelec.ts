import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText, parseFrenchDate } from "./util.js";

/**
 * Transelec/Common (TCI+) — page WordPress VINCI Energies.
 * Les postes vedettes sont des `<li>` dans `.job-offers-list` (titre, lieu,
 * lien jobs.vinci.com). Le catalogue complet est sur Jobillico (`careersUrl2`).
 */
const ID = "transelec-com";
const COMPANY = "Transelec/Common inc.";
const CAREERS_URL = "https://www.tciplus.ca/accueil-2/nous-rejoindre/nos-offres-demploi/";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Parseur PUR : cartes « Nos offres d'emploi » → offres. */
export function parseTranselec(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $("ul.job-offers-list a.job-offers").each((_, el) => {
    const $a = $(el);
    const href = ($a.attr("href") ?? "").trim();
    const title = cleanText($a.find("h3.function").first().text()) || cleanText($a.attr("aria-label") ?? "");
    if (!title || !href) return;
    const url = absolute(baseUrl, href).split("#")[0]!;
    if (seen.has(url) || /recherche-d/i.test(url)) return;
    seen.add(url);

    const location = cleanText($a.find(".location").first().text()) || undefined;
    const postedAt = parseFrenchDate($a.find(".additional-infos__publication-time").first().text());

    jobs.push({
      sourceId: ID,
      url,
      title: title.replace(/^Consulter l[’']offre d[’']emploi\s*[-–—]\s*/i, ""),
      company: COMPANY,
      location,
      postedAt,
      tags: [],
    });
  });

  return jobs;
}

export const transelecScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseTranselec(html, baseUrl || CAREERS_URL),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL, { userAgent: BROWSER_UA });
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseTranselec(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
