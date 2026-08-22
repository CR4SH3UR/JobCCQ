import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * Électricité MC2 (electricitemc2.com/carrieres/) — entrepreneur électricien.
 *
 * Page WordPress/Elementor : les postes sont des **cartes**
 * (`.elementor-image-box-title`), reprises à l'identique dans les options du
 * formulaire de candidature. Le scraper générique ne captait que les intitulés
 * contenant un métier connu (« …électricien.ne ») et ratait « Chef de projet en
 * électricité » (rôle/domaine hors de sa liste de mots-clés).
 *
 * Ce parseur prend les titres des cartes Elementor (dédoublonnés, l'accroche
 * « candidature spontanée » écartée) → toutes les offres, quel que soit le métier.
 */
const ID = "electricitemc2-com";
const COMPANY = "Électricité MC2 inc.";
const CAREERS_URL = "https://electricitemc2.com/carrieres/";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const NOT_A_JOB = /candidature\s+spontan|^\s*$/i;

/** Parse les cartes de postes Elementor (`.elementor-image-box-title`). */
export function parseElectriciteMc2(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const base = baseUrl.replace(/#.*$/, "").replace(/\/+$/, "");
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $(".elementor-image-box-title").each((_, el) => {
    const title = cleanText($(el).text());
    if (!title || NOT_A_JOB.test(title)) return;
    const slug = slugify(title);
    if (seen.has(slug)) return; // cartes dupliquées (variantes mobile/desktop)
    seen.add(slug);
    jobs.push({ sourceId: ID, url: `${base}/#${slug}`, title, company: COMPANY, tags: [] });
  });

  return jobs;
}

export const electriciteMc2Scraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseElectriciteMc2(html, baseUrl || CAREERS_URL);
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL, { userAgent: BROWSER_UA });
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseElectriciteMc2(html, CAREERS_URL);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    return jobs;
  },
};
