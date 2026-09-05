import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText } from "./util.js";

/**
 * Boless inc. (boless.com) — entrepreneur en construction (Outaouais).
 *
 * Le site WordPress affiche ses postes sur la page carrières sous forme
 * d'articles `type-carriere`. Chaque article contient :
 *   - un titre en h4 dans `.post_text_inner`
 *   - un court paragraphe de description
 *   - un paragraphe décoratif « Voir l'offre » (`.qbutton.small`)
 *   - un lien vide `<a href="..." title="...">` à côté du bloc texte
 *
 * Le scraper générique ne reconnaît pas cette structure (le lien réel est vide
 * et le texte « Voir l'offre » est dans un <p>, pas dans le <a>), d'où ce
 * parseur dédié.
 */
const ID = "boless-com";
const COMPANY = "Boless inc.";
const CAREERS_URL = "https://www.boless.com/carriere/";

function absoluteUrl(href: string, baseUrl: string): string | undefined {
  try {
    return new URL(href, baseUrl).toString().split("#")[0];
  } catch {
    return undefined;
  }
}

/** Parse la page carrières de Boless et retourne une offre par article trouvé. */
export function parseBoless(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  const articles = $("article.type-carriere, article.carriere");

  articles.each((_, article) => {
    const $article = $(article);
    const holder = $article.find(".post_content_holder").first();
    const container = holder.length ? holder : $article;

    const title = cleanText(container.find("h4, h3, h2, h1").first().text());
    if (!title || title.length < 3) return;

    // Premier paragraphe qui n'est pas le bouton décoratif « Voir l'offre ».
    const description = cleanText(
      container.find("p").not(".qbutton").first().text(),
    );

    const link = container.find("a[href]").first();
    const href = (link.attr("href") ?? "").trim();
    if (!href) return;

    const url = absoluteUrl(href, baseUrl);
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

export const bolessScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseBoless(html, baseUrl || CAREERS_URL);
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
    const jobs = parseBoless(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
