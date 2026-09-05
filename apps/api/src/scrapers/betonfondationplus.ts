import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";
import { htmlToText } from "./jsonld.js";

/**
 * Béton Fondation Plus (betonfondationplus.com) — coffrage, béton et excavation.
 *
 * La page carrières affiche les postes disponibles directement dans le HTML,
 * sous forme d'accordéons Bootstrap (`#postes .card`). Chaque poste a un titre
 * dans `.poste p.mb-0`, une description riche dans `.card-body.liste-carre` et
 * un bouton de postulation (sans lien direct) qui porte `data-poste` et
 * `data-division`. Les offres n'ayant pas d'URL individuelle, on génère une
 * ancre stable basée sur le titre et la division pour l'identifiant unique.
 */
const ID = "betonfondationplus-com";
const COMPANY = "Béton Fondation Plus inc.";
const CAREERS_URL = "https://betonfondationplus.com/carriere/";

/** Génère une URL stable avec fragment pour une offre sans page dédiée. */
function makeJobUrl(title: string, division?: string, seen = new Set<string>()): string {
  const parts = [slugify(title)];
  if (division) parts.push(slugify(division));
  let base = parts.join("-");
  let candidate = `${CAREERS_URL}#${base}`;
  let suffix = 1;
  while (seen.has(candidate)) {
    suffix++;
    candidate = `${CAREERS_URL}#${base}-${suffix}`;
  }
  seen.add(candidate);
  return candidate;
}

/** Extrait les postes affichés dans l'accordéon `#postes`. */
export function parseBetonFondationPlus(html: string): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $("#postes .card.pb-3").each((_, card) => {
    const $card = $(card);
    const title = cleanText($card.find(".poste p.mb-0").first().text());
    if (!title) return;

    const division = cleanText($card.find("a.btn_postulation").first().attr("data-division"));
    const url = makeJobUrl(title, division, seen);

    const description = htmlToText($card.find(".card-body.liste-carre").first().html() ?? undefined, 800);

    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      location: division,
      description,
      tags: division ? [division] : [],
    });
  });

  return jobs;
}

export const betonFondationPlusScraper: Scraper = {
  id: ID,
  parseList(html: string): RawJob[] {
    return parseBetonFondationPlus(html);
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
    const jobs = parseBetonFondationPlus(html);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
