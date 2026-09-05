import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * Gestion A. Godin (gestion immobilière / mécanique du bâtiment, Beloeil).
 *
 * Les postes sont des intitulés en **gras** (`<li><strong>…`) dans la section
 * « Emplois » — pas des liens/ancres, d'où le repli générique qui en ratait
 * (ex. « Gérant(e) de chantier »). On lit donc les `<strong>` de liste et on
 * écarte les lignes d'exigences (« Certificat de compétence… ») et le bruit
 * (« SANS FRAIS », numéros). Chaque poste pointe vers la page (ancre = slug).
 */
const ID = "gestionagodin-com";
const COMPANY = "Gestion A. Godin";
const CAREERS = "https://gestionagodin.com/emplois/";
const LOCATION = "Beloeil, QC";

/** Lignes en gras qui ne sont PAS des postes (exigences, coordonnées, bruit). */
const NOT_A_JOB =
  /certificat de comp[eé]tence|compagnon de la ccq|apprenti de la ccq|carte de comp|sans frais|^\d|t[eé]l[eé]phone|courriel|@|exigence|description de t[aâ]ches?|avantages?|pourquoi|responsabilit/i;

export function parseAgodin(html: string, url = CAREERS): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  $("li strong, li b").each((_, el) => {
    const title = cleanText($(el).text());
    // Un vrai intitulé : quelques mots, ni exigence ni coordonnée.
    if (title.length < 8 || title.length > 80 || !/\s/.test(title)) return;
    if (NOT_A_JOB.test(title)) return;
    const slug = slugify(title);
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    jobs.push({ sourceId: ID, url: `${CAREERS}#${slug}`, title, company: COMPANY, location: LOCATION });
  });
  return jobs;
}

export const gestionAgodinScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseAgodin(html, baseUrl || CAREERS),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS);
    } catch (err) {
      ctx.log(`${ID} — échec : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseAgodin(html, CAREERS);
    if (jobs.length === 0 && html.length > 2000) ctx.markNoOpenings?.(false);
    ctx.log(`${ID} — ${jobs.length} poste(s)`);
    return jobs;
  },
};
