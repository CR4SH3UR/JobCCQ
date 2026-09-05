import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify, mapEmploymentType } from "./util.js";

/**
 * Bruanto Construction (bruantoconstruction.com) — charpente / menuiserie.
 *
 * La page carrières est une page Elementor statique qui affiche chaque poste
 * dans une section interne (`elementor-inner-section`) composée de :
 *   - un titre de poste dans `<p class="elementor-heading-title">`
 *   - une description en liste à puces dans un `elementor-widget-text-editor`
 *   - une icône décorative lien vers l’ancre `#contact`
 *
 * Il n’y a pas de page dédiée par offre. On génère donc une URL par poste en
 * ajoutant un fragment basé sur le titre (ex. `#compagnon-apprenti-charpente`).
 */
const ID = "bruantoconstruction-com";
const COMPANY = "Bruanto Construction";
const CAREERS_URL = "https://bruantoconstruction.com/carriere-menuisiers/";

function buildJobUrl(title: string, baseUrl = CAREERS_URL): string {
  const base = baseUrl.split("#")[0]!;
  const slug = slugify(title);
  return slug ? `${base}#${slug}` : base;
}

/** Parse la page carrières de Bruanto et retourne une offre par poste trouvé. */
export function parseBruantoConstruction(
  html: string,
  baseUrl = CAREERS_URL,
): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  // Chaque poste est dans une section interne Elementor contenant un titre
  // de poste et une liste de description.
  $("section.elementor-inner-section").each((_, section) => {
    const $section = $(section);

    // Le titre est dans le premier widget heading de la section.
    const titleEl = $section
      .find(".elementor-widget-heading .elementor-heading-title")
      .first();
    const title = cleanText(titleEl.text());
    if (!title || title.length < 3) return;

    // Ignore les blocs génériques sans liste de description (ex. « Postulez en ligne! »).
    const listItems = $section.find(
      ".elementor-widget-text-editor ul li, .elementor-widget-text-editor ol li",
    );
    if (listItems.length === 0) return;

    const url = buildJobUrl(title, baseUrl);
    if (seen.has(url)) return;

    const description = listItems
      .map((_, li) => cleanText($(li).text()))
      .get()
      .filter(Boolean)
      .join("\n");

    seen.add(url);
    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      description: description || undefined,
      employmentType: mapEmploymentType(title),
      tags: [],
    });
  });

  return jobs;
}

export const bruantoconstructionScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseBruantoConstruction(html, baseUrl || CAREERS_URL);
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
    const jobs = parseBruantoConstruction(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
