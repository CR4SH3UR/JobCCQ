import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * Cuisines Stef & Max (stefetmax.com/carrieres) — armoires / ébénisterie.
 *
 * Les postes sont des **titres `h3`** listés sous « … POUR LES POSTES SUIVANTS ».
 * Le scraper générique en ratait (« Aide-livreur / Aide-livreuse » — métier hors
 * liste) et en tronquait (« aide-ébéniste / ASSEMBLEUR à temps plein » → coupé à
 * « aide-ébéniste » par le découpage sur « / »).
 *
 * Ce parseur prend chaque `h3` de la page comme un poste (en écartant l'intro et
 * les en-têtes de section), **sans découper** l'intitulé — on garde le titre
 * entier tel que publié.
 */
const ID = "stefetmax-com";
const COMPANY = "Cuisines Stef & Max inc.";
const CAREERS_URL = "https://stefetmax.com/carrieres";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Intitulés `h3` qui ne sont PAS des postes (intro, en-têtes de section).
const NOT_A_JOB =
  /postes?\s+suivants?|recherche de candidatur|candidature spontan|expansion|nous joindre|vos designers|heures d['’]ouverture|que ce soit|foire aux questions|^faq$/i;

/** Prend chaque `h3` « poste » de la page carrières (titre entier, non découpé). */
export function parseStefetmax(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const base = baseUrl.replace(/#.*$/, "").replace(/\/+$/, "");
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $("h3").each((_, el) => {
    const raw = cleanText($(el).text());
    if (!raw || raw.length > 70 || NOT_A_JOB.test(raw)) return; // écarte intro / sections
    const title = raw.replace(/[.\s]+$/, "").trim(); // retire la ponctuation finale
    if (title.length < 3) return;
    const url = `${base}#${slugify(title)}`;
    if (seen.has(url)) return;
    seen.add(url);
    jobs.push({ sourceId: ID, url, title, company: COMPANY, tags: [] });
  });

  return jobs;
}

export const stefetmaxScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseStefetmax(html, baseUrl || CAREERS_URL);
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL, { userAgent: BROWSER_UA });
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseStefetmax(html, CAREERS_URL);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    return jobs;
  },
};
