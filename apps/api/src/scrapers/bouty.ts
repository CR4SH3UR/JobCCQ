import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText, slugify } from "./util.js";

/**
 * Bouty inc. (bouty.com) — fabricant de fauteuils.
 *
 * La page carrières affiche chaque poste dans un bloc `.wysiwyg` contenant :
 *   - un titre de poste en `<h3>` (parfois suivi d’un sous-titre `<h4>`)
 *   - un court paragraphe de description
 *   - un lien PDF « Télécharger la description du poste »
 *   - un lien « Postulez ici » vers une adresse courriel
 *
 * Le parseur associe le titre au lien PDF s’il est présent, sinon retombe sur la
 * page carrières avec une ancre basée sur le titre.
 */
const ID = "bouty-com";
const COMPANY = "Bouty inc.";
const CAREERS_URL = "https://www.bouty.com/fr/a-propos/carrieres/";

/** Détermine l’URL de l’offre : PDF absolu ou page carrières + fragment. */
function makeJobUrl(title: string, pdfHref: string | undefined, baseUrl: string): string {
  if (pdfHref) {
    const resolved = absolute(baseUrl, pdfHref);
    if (resolved) return resolved.split("#")[0]!;
  }
  return `${baseUrl}#${slugify(title)}`;
}

/** Parse la page carrières de Bouty et retourne une offre par bloc de poste. */
export function parseBouty(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $(".wysiwyg").each((_, element) => {
    const $block = $(element);
    const $h3 = $block.find("h3").first();
    if (!$h3.length) return;

    const h3Title = cleanText($h3.text());
    if (!h3Title || h3Title.length < 3) return;

    const h4Title = cleanText($block.find("h4").first().text());
    const title = h4Title ? `${h3Title} — ${h4Title}` : h3Title;

    // Premier paragraphe qui n’est pas l’ancre PDF ni le lien « Postulez ici ».
    const description = $block
      .find("p")
      .toArray()
      .map((p) => cleanText($(p).text()))
      .find(
        (text) =>
          text.length > 0 &&
          !/télécharger\s+la\s+description\s+du\s+poste/i.test(text) &&
          !/postulez\s+ici/i.test(text),
      );

    const pdfHref = $block.find('a[href$=".pdf"]').first().attr("href")?.trim();
    const url = makeJobUrl(title, pdfHref, baseUrl);
    if (!url || seen.has(url)) return;

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

export const boutyScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseBouty(html, baseUrl || CAREERS_URL);
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
    const jobs = parseBouty(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
