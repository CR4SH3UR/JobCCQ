import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText } from "./util.js";

/**
 * Climatisation R. Bessette inc. — page Elementor `/carrieres/`.
 * Chaque offre a sa propre fiche `/carrieres-<metier>/` ou `/carriere-<metier>/`.
 * Le scrape générique mélangeait les libellés de navigation
 * (« Carrières- Frigoriste ») avec les vrais intitulés.
 */
const ID = "crbessette-com";
const COMPANY = "Climatisation R. Bessette inc.";
const CAREERS_URL = "https://www.crbessette.com/carrieres/";
const LOCATION = "Joliette, QC";

const JOB_PATH = /\/carrieres?-[^/#?]+\/?$/i;
const NAV_PREFIX = /^carri[eè]res?\s*[-–—:]\s*/i;

function jobTitle(raw: string): string {
  return cleanText(raw).replace(NAV_PREFIX, "").trim();
}

function canonUrl(url: string): string {
  return url.replace(/\/+$/, "") + "/";
}

/** Parseur PUR : liens vers les fiches `/carrieres?-…` → offres. */
export function parseCrBessette(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const byUrl = new Map<string, RawJob>();

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href || !JOB_PATH.test(href.split("?")[0] ?? "")) return;
    const title = jobTitle($(el).text());
    if (!title || title.length < 3 || title.length > 120) return;
    if (/^carri[eè]res?$/i.test(title)) return;

    const url = canonUrl(absolute(baseUrl.split("#")[0]!, href.split("?")[0]!));
    const prev = byUrl.get(url);
    // On préfère l'intitulé court de la carte (« Frigoriste ») au libellé de nav.
    if (prev && prev.title.length <= title.length) return;
    byUrl.set(url, {
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      location: LOCATION,
      tags: [],
    });
  });

  return [...byUrl.values()];
}

export const crBessetteScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseCrBessette(html, baseUrl || CAREERS_URL),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL);
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseCrBessette(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
