import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText } from "./util.js";
import { htmlToText } from "./jsonld.js";

/**
 * Béton Surface (betonsurface.ca) — revêtement de plancher en époxy et béton.
 *
 * La page carrières présente les postes sous forme d'onglets (`#mk-tabs`).
 * Chaque onglet contient un titre `<h2>`, une description riche et un bouton
 * « DÉPOSER MA CANDIDATURE » (classe `mk-button`) qui mène à la page de poste
 * correspondante. On parse ces onglets pour extraire titre, URL et description.
 */
const ID = "betonsurface-ca";
const COMPANY = "Béton Surface Estrie";
const CAREERS_URL = "https://www.betonsurface.ca/contact/emplois/";

/** Extrait les postes listés dans les onglets de la page carrières. */
export function parseBetonSurface(html: string): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $("#mk-tabs .wpb_tab").each((_, tab) => {
    const $tab = $(tab);
    const title = cleanText($tab.find("h2").first().text());
    if (!title) return;

    // Le bouton principal de candidature porte la classe mk-button.
    let url = $tab.find("a.mk-button").first().attr("href")?.trim().split("?")[0];
    if (!url) return;

    if (seen.has(url)) return;
    seen.add(url);

    // Pour la description, on retire le titre et le(s) bouton(s) de candidature.
    const $desc = $tab.clone();
    $desc.find("h2").first().remove();
    $desc.find("a.mk-button").remove();
    const description = htmlToText($desc.html() ?? undefined, 800);

    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      description,
      tags: [],
    });
  });

  return jobs;
}

export const betonSurfaceScraper: Scraper = {
  id: ID,
  parseList(html: string): RawJob[] {
    return parseBetonSurface(html);
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
    const jobs = parseBetonSurface(html);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
