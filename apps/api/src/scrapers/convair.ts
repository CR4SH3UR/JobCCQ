import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText, slugify } from "./util.js";

/**
 * Camfab inc. (CON-V-AIR) — con-v-air.com
 *
 * La page carrières utilise un loop-grid Elementor qui affiche chaque poste
 * dans une carte `.e-loop-item`. Chaque carte contient :
 *   - un titre en h3 avec un lien vers la fiche de poste
 *   - un bouton "Postuler" pointant vers la même URL
 *
 * Le parseur extrait le titre du h3 et l'URL du bouton (ou du h3 en repli).
 */
const ID = "con-v-air-com";
const COMPANY = "CON-V-AIR";
const CAREERS_URL = "https://www.con-v-air.com/carrieres/";

function resolveUrl(href: string | undefined, baseUrl: string): string | undefined {
  if (!href) return undefined;
  const url = absolute(baseUrl, href.trim());
  try {
    return new URL(url).toString().split("#")[0];
  } catch {
    return undefined;
  }
}

/** Parse la page carrières de CON-V-AIR et retourne une offre par carte trouvée. */
export function parseConvair(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $(".e-loop-item").each((_, item) => {
    const $item = $(item);

    const titleEl = $item.find("h3, h2, h4, h1").first();
    const title = cleanText(titleEl.text());
    if (!title || title.length < 3) return;

    // Priorité au bouton "Postuler", puis au lien du titre, puis ancre sur la page carrières.
    const buttonHref = $item.find("a.elementor-button-link").attr("href");
    const headingHref = titleEl.find("a").attr("href");
    let url = resolveUrl(buttonHref, baseUrl) ?? resolveUrl(headingHref, baseUrl);
    if (!url) {
      const fragment = slugify(title);
      url = `${baseUrl.split("#")[0]}#${fragment}`;
    }

    if (seen.has(url)) return;
    seen.add(url);

    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      tags: [],
    });
  });

  return jobs;
}

export const convairScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseConvair(html, baseUrl || CAREERS_URL);
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
    const jobs = parseConvair(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
