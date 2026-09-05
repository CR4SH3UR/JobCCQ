import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { ScrapeContext, ScrapeParams, Scraper } from "./types.js";
import { absolute, cleanText } from "./util.js";

/**
 * QMB (signalisation et marquage routier, Laval) — page carrières maison.
 * Chaque poste est une carte-lien :
 *   <a href="/carrieres/<slug>/">
 *     <span>Titre</span><span class="location">Ville, QC</span>
 *     <p class="btn-default">Postuler</p>
 *   </a>
 * On ne retient que les vraies fiches `/carrieres/<slug>/` (hors galerie
 * d'images `/carrieres/gallery/…`, hors bascule de langue `/en/carrieres/`).
 */
const ID = "qmb-ca";
const COMPANY = "QMB";
const CAREERS = "https://qmb.ca/carrieres/";
const JOB_URL_RE = /\/carrieres\/(?!gallery\/)[^/]+\/$/i;

export function parseQmb(html: string, baseUrl = CAREERS): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  $("a[href]").each((_, el) => {
    const $a = $(el);
    const url = absolute(baseUrl, $a.attr("href") ?? "");
    if (!JOB_URL_RE.test(url) || /\/(?:en|fr)\/carrieres\//i.test(url) || seen.has(url)) return;
    const location = cleanText($a.find(".location").first().text());
    // Titre = 1er <span> hors .location ; repli = texte du lien sans les à-côtés.
    let title = cleanText($a.find("span").not(".location").first().text());
    if (!title) {
      title = cleanText($a.clone().find(".location, .btn-default, p, span.location").remove().end().text());
    }
    if (!title) return;
    seen.add(url);
    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      ...(location ? { location } : {}),
    });
  });
  return jobs;
}

export const qmbScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseQmb(html, baseUrl),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS);
    } catch (err) {
      ctx.log(`${ID} — échec : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseQmb(html, CAREERS);
    if (jobs.length === 0 && html.length > 2000) ctx.markNoOpenings?.(false);
    ctx.log(`${ID} — ${jobs.length} poste(s)`);
    return jobs;
  },
};
