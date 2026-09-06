import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * CMI Côte Nord — page Wix `/emplois`.
 * Les postes ouverts sont des boutons `a.wixui-button` (souvent un PDF partagé).
 * On déduplique sur le titre : l'URL du PDF n'est pas unique par offre.
 * UA navigateur (Wix/Cloudflare peut renvoyer 403).
 */
const ID = "cmicotenord-ca";
const COMPANY = "CMI Côte Nord";
const CAREERS_URL = "https://www.cmicotenord.ca/emplois";
const LOCATION = "Baie-Comeau, QC";
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const NOT_A_JOB =
  /^(envoyer|soumettre|contactez[- ]nous|nous joindre|emplois|postes?\s+disponibles|candidature\s+spontan)$/i;

/** Parseur PUR : boutons Wix / liens PDF → offres. */
export function parseCmiCoteNord(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const base = baseUrl.split("#")[0]!;
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $("a.wixui-button, a[href*='.pdf']").each((_, el) => {
    const title = cleanText($(el).attr("aria-label") || $(el).find(".wixui-button__label").text() || $(el).text());
    if (!title || title.length < 4 || title.length > 120 || NOT_A_JOB.test(title)) return;
    const url = `${base}#${slugify(title)}`;
    if (seen.has(url)) return;
    seen.add(url);
    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      location: LOCATION,
      tags: [],
    });
  });

  return jobs;
}

export const cmiCoteNordScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseCmiCoteNord(html, baseUrl || CAREERS_URL),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page emplois : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL, { userAgent: BROWSER_UA });
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseCmiCoteNord(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
