import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * Coffrage Rive-Nord et Fils inc. — page Ubiweb/Duda `/carrieres`.
 * Les postes sont des `<h3>` sous « Offres d'emplois » (ex. « Chauffeur
 * recherché ») + une liste à puces. Pas de fiche dédiée : ancre `#slug`.
 * Le scrape générique jette ces titres (mot « recherché »).
 */
const ID = "coffragerivenord-com";
const COMPANY = "Coffrage Rive-Nord et Fils inc.";
const CAREERS_URL = "https://www.coffragerivenord.com/carrieres";
const LOCATION = "Saint-Gabriel-de-Brandon, QC";
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const SKIP =
  /^(offres?\s+d['’]?emplois?|carri[eè]res?|faites partie|contact(\s+us)?|nous joindre|estimation|candidature)$/i;

function bulletsFrom($: cheerio.CheerioAPI, $h3: cheerio.Cheerio<cheerio.Element>): string | undefined {
  const $group = $h3.closest(".flex-element.group");
  const items = $group
    .find("li")
    .map((_, li) => cleanText($(li).text()))
    .get()
    .filter(Boolean);
  if (!items.length) return undefined;
  return items.map((t) => `• ${t}`).join("\n");
}

/** Parseur PUR : titres H3 de la section offres → postes. */
export function parseCoffrageRiveNord(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const base = baseUrl.split("#")[0]!;
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $("h3").each((_, el) => {
    const $h3 = $(el);
    if ($h3.closest("form, .dmform").length) return;
    const title = cleanText($h3.text());
    if (!title || title.length < 4 || title.length > 120 || SKIP.test(title)) return;

    const url = `${base}#${slugify(title)}`;
    if (seen.has(url)) return;
    seen.add(url);

    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      location: LOCATION,
      description: bulletsFrom($, $h3),
      tags: [],
    });
  });

  return jobs;
}

export const coffrageRiveNordScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseCoffrageRiveNord(html, baseUrl || CAREERS_URL),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL, { userAgent: BROWSER_UA });
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseCoffrageRiveNord(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
