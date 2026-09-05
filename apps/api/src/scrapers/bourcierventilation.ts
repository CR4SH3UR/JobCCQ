import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText, slugify } from "./util.js";

/**
 * Bourcier Ventilation inc. (shop.bourcierventilation.com) — spécialiste en
 * ventilation et CVAC. La page carrière Shopify présente les postes sous forme
 * de sections avec un titre de poste, une courte description et un lien
 * « Postuler ici ». Ce lien est généralement une ancre vers le formulaire de
 * contact ou un mailto, il est donc remplacé par la page carrière avec un
 * fragment basé sur le titre du poste.
 */
const ID = "bourcierventilation-com";
const COMPANY = "Bourcier Ventilation inc.";
const CAREERS_URL = "https://shop.bourcierventilation.com/pages/carriere";

/** Détermine l'URL d'une offre à partir du lien "Postuler ici". */
function resolveUrl(href: string, baseUrl: string, title: string): string {
  const fallback = `${baseUrl}#${slugify(title)}`;
  const h = href.trim();
  if (!h || h.startsWith("#") || h.startsWith("mailto:")) return fallback;
  return absolute(baseUrl, h) || fallback;
}

/** Parse la page carrières de Bourcier Ventilation. */
export function parseBourcierVentilation(
  html: string,
  baseUrl = CAREERS_URL,
): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $("a").each((_, el) => {
    const $link = $(el);
    if (!/postuler/i.test(cleanText($link.text()))) return;

    // Cherche le conteneur de l'offre puis le premier titre à l'intérieur.
    let $container = $link.closest("div, section, article, li");
    if (!$container.length) $container = $link.parent();

    let $title = $container.find("h3, h4, h2, h1, strong").first();
    if (!$title.length) {
      $title = $link
        .prevAll("h3, h4, h2, h1, strong")
        .first();
    }
    if (!$title.length) return;

    const title = cleanText($title.text());
    if (!title || title.length < 3) return;

    // Description : premier paragraphe dans le conteneur, hors lien de candidature.
    const description = cleanText(
      $container.find("p").not("p:has(a)").first().text(),
    );

    const url = resolveUrl($link.attr("href") ?? "", baseUrl, title);
    if (seen.has(url)) return;
    seen.add(url);

    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      description: description || undefined,
      tags: [],
    });
  });

  return jobs;
}

export const bourcierVentilationScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseBourcierVentilation(html, baseUrl || CAREERS_URL);
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
    const jobs = parseBourcierVentilation(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
