import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText, mapEmploymentType } from "./util.js";

/**
 * Béton GL inc. (betongl.com) — entrepreneur en béton à Drummondville.
 *
 * La page /carrieres/ affiche les postes sous forme de lignes WordPress
 * (wp-block-columns) : 4 colonnes (titre, lieu, type d'emploi, lien Détails).
 * On parse ces lignes pour extraire titre, URL, localisation et type de poste.
 */
const ID = "betongl-com";
const COMPANY = "Béton GL inc.";
const CAREERS_URL = "https://betongl.com/carrieres/";

/** Parse la section « POSTES DISPONIBLES » de la page carrières. */
export function parseBetonGl(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const base = baseUrl.replace(/#.*$/, "").replace(/\/+$/, "");
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  // Cible la section sous le h2 « POSTES DISPONIBLES » pour ignorer le formulaire
  // de candidature spontanée qui suit.
  const $section = $("h2.wp-block-heading:contains('POSTES DISPONIBLES')").closest(".wp-block-group");
  const $rows = $section.length ? $section.find(".wp-block-columns") : $(".wp-block-columns");

  $rows.each((_, row) => {
    const $cols = $(row).find("> .wp-block-column");
    if ($cols.length < 4) return;

    const $first = $cols.first();
    const $last = $cols.last();

    const titleLink = $first.find("a[href]").first();
    const detailLink = $last.find("a[href]").first();

    const title = cleanText(titleLink.text());
    let url = cleanText(titleLink.attr("href") || detailLink.attr("href"));
    if (!title || !url) return;

    url = absolute(base, url);
    if (seen.has(url)) return;
    seen.add(url);

    const location = cleanText($cols.eq(1).text());
    const employmentType = mapEmploymentType($cols.eq(2).text());

    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      location: location || undefined,
      employmentType,
      tags: [],
    });
  });

  return jobs;
}

export const betonGlScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseBetonGl(html, baseUrl || CAREERS_URL);
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL);
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseBetonGl(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
