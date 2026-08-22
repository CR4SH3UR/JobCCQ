import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, deslugify } from "./util.js";

/**
 * Construction Marc Drolet (droletconstruction.com/carrieres) — site Webflow.
 *
 * Chaque poste est un item de collection Webflow : le **titre** est dans un `h4`
 * et le lien vers la fiche porte un libellé générique « Consultez le poste ». Le
 * scraper générique retenait donc « Consultez le poste » comme titre pour les
 * 7 offres. Ce parseur lit le titre depuis le `h4` de la carte et l'URL depuis
 * le lien `/postes-disponible/<slug>`.
 */
const ID = "droletconstruction-com";
const COMPANY = "Construction Marc Drolet inc.";
const CAREERS_URL = "https://www.droletconstruction.com/carrieres";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Parse les cartes de postes (items de collection Webflow). */
export function parseDrolet(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $('a[href*="/postes-disponible/"]').each((_, el) => {
    const $a = $(el);
    const href = ($a.attr("href") ?? "").trim();
    if (!href) return;
    let url: string;
    try {
      url = new URL(href, baseUrl).toString().split("#")[0]!.split("?")[0]!;
    } catch {
      return;
    }
    if (seen.has(url)) return;

    // Titre = intitulé (h1-h6) de la carte ; repli : slug de l'URL « déslugifié ».
    const $item = $a.closest('[role="listitem"], .w-dyn-item');
    let title = cleanText($item.find("h1,h2,h3,h4,h5,h6").first().text());
    if (!title) {
      const slug = url.split("/").filter(Boolean).pop() ?? "";
      title = deslugify(slug);
    }
    if (!title) return;

    seen.add(url);
    jobs.push({ sourceId: ID, url, title, company: COMPANY, tags: [] });
  });

  return jobs;
}

export const droletConstructionScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseDrolet(html, baseUrl || CAREERS_URL);
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL, { userAgent: BROWSER_UA });
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseDrolet(html, CAREERS_URL);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    return jobs;
  },
};
