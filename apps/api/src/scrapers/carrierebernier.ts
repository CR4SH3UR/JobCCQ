import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * Carrière Bernier Ltée (carrierebernier.com) — producteur de pierre, d'asphalte
 * et de béton en Montérégie.
 *
 * La page « Emplois » (WordPress) affiche chaque poste dans un accordéon :
 *   - un lien-bascule `a.toggle` contenant le titre en `<h2>`
 *   - un bloc `.toggle-box` frère avec la description et un lien « POSTULER ICI »
 *
 * Les postes n'ont pas d'URL propre (accordéon) : on fabrique une ancre stable
 * `…/emplois/#slug` à partir du titre.
 */
const ID = "carrierebernier-com";
const COMPANY = "Carrière Bernier Ltée";
const CAREERS_URL = "https://www.carrierebernier.com/emplois/";

/** Paragraphes de « garniture » à écarter pour trouver un vrai résumé du poste. */
const BOILERPLATE = /^(description du poste|veuillez nous envoyer|postuler ici)/i;

/** Parse la page « Emplois » de Carrière Bernier : une offre par accordéon. */
export function parseCarriereBernier(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const base = baseUrl.split("#")[0]!;
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $("a.toggle").each((_, element) => {
    const $toggle = $(element);
    const title = cleanText($toggle.find("h2").first().text());
    if (!title || title.length < 3) return;

    const url = `${base}#${slugify(title)}`;
    if (seen.has(url)) return;
    seen.add(url);

    // Premier paragraphe utile du bloc dépliant : on saute le préambule
    // d'entreprise (identique partout) et les mentions « postuler / envoyer CV ».
    const paragraphs = $toggle
      .next(".toggle-box")
      .find("p")
      .toArray()
      .map((p) => cleanText($(p).text()))
      .filter((text) => text.length > 0 && !BOILERPLATE.test(text));
    const description =
      paragraphs.find((text) => /recherch/i.test(text)) ?? paragraphs[1] ?? paragraphs[0];

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

export const carriereBernierScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseCarriereBernier(html, baseUrl || CAREERS_URL);
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
    const jobs = parseCarriereBernier(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
