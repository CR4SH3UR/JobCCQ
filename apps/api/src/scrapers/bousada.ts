import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";
import { htmlToText } from "./jsonld.js";

/**
 * Bousada (bousada.com) — couvre-plancher, surfaces commerciales, institutionnelles
 * et résidentielles.
 *
 * La page carrières présente les postes comme une suite de sections dont chacune
 * commence par un titre de la forme « Poste : … ». On itère ces sections, on en
 * extrait le titre, l'endroit et la description (à partir de « Description du poste : »).
 * Les candidatures se font par courriel ; il n'y a pas d'URL individuelle par poste,
 * donc on génère une ancre stable basée sur le titre.
 */
const ID = "bousada-com";
const COMPANY = "Les intérieurs Bousada";
const CAREERS_URL = "https://bousada.com/carriere/";

/** Extrait les sections de poste délimitées par les titres « Poste : … ». */
export function parseBousada(html: string): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  const posteHeadings = $("h1, h2, h3, h4, h5, h6")
    .filter((_, el) => /^Poste\s*:/i.test(cleanText($(el).text())))
    .toArray();

  for (const heading of posteHeadings) {
    const $h = $(heading);
    const titleMatch = cleanText($h.text()).match(/^Poste\s*:\s*(.+)/i);
    if (!titleMatch) continue;
    const title = titleMatch[1]!.trim();

    // Collecte les éléments frères jusqu'au prochain titre de poste.
    const $block = $("<div></div>");
    let $next = $h.next();
    while ($next.length && !/^Poste\s*:/i.test(cleanText($next.text()))) {
      $block.append($next.clone());
      $next = $next.next();
    }

    let location: string | undefined;
    $block.find("h1, h2, h3, h4, h5, h6, p").each((_, el) => {
      const t = cleanText($(el).text());
      const m = t.match(/^Endroit\s*:\s*(.+)/i);
      if (m) location = m[1]!.replace(/En savoir plus\s*$/i, "").trim();
    });

    let description: string | undefined;
    const $descHeading = $block
      .find("h1, h2, h3, h4, h5, h6, p")
      .filter((_, el) => /^Description du poste\s*:/i.test(cleanText($(el).text())))
      .first();
    if ($descHeading.length) {
      const descHtml = $descHeading
        .nextAll()
        .map((_, el) => $(el).clone().wrap("<div></div>").parent().html())
        .get()
        .join(" ");
      description = htmlToText(descHtml, 800);
    }

    const url = `${CAREERS_URL}#${slugify(title)}`;
    if (seen.has(url)) continue;
    seen.add(url);

    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      location,
      description,
      tags: [],
    });
  }

  return jobs;
}

export const bousadaScraper: Scraper = {
  id: ID,
  parseList(html: string): RawJob[] {
    return parseBousada(html);
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
    const jobs = parseBousada(html);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
