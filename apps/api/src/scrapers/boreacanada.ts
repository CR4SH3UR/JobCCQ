import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * BoreA Canada (boreacanada.com) — producteur de produits naturels de la
 * forêt boréale.
 *
 * La page /emplois/ est une page de carrière statique qui présente les postes
 * ouverts comme de simples titres de texte sous la section
 * « Opportunités de carrière ». Il n'y a pas de liens distincts par poste.
 * Le parseur fabrique donc une URL par poste en ajoutant un fragment basé sur
 * le titre du poste (slugifié) pour éviter les collisions.
 */
const ID = "boreacanada-com";
const COMPANY = "BoreA Canada";
const CAREERS_URL = "https://boreacanada.com/emplois/";

/**
 * Détermine si un élément donné est probablement le titre d'un poste.
 * On accepte les titres courts (≤ 10 mots) qui ne sont pas des questions FAQ.
 */
function isJobTitle(text: string): boolean {
  const t = cleanText(text);
  if (!t || t.length < 3 || t.length > 120) return false;
  if (t.endsWith("?")) return false; // questions de la FAQ
  if (/^\d+\./.test(t)) return false; // items numérotés
  const wordCount = t.split(/\s+/).length;
  return wordCount <= 10 && wordCount >= 2;
}

/** Collecte les titres de poste présents dans la section « Opportunités de carrière ». */
function collectJobTitles($: cheerio.CheerioAPI): string[] {
  const headings = $("h1, h2, h3, h4, h5, h6");
  let careerHeading: AnyNode | undefined;

  headings.each((_, el) => {
    if (!careerHeading && /opportunit(?:é|e)s?\s+de\s+carri(?:è|e)re/i.test(cleanText($(el).text()))) {
      careerHeading = el;
      return false;
    }
  });

  if (!careerHeading) return [];

  const titles: string[] = [];
  const tagName = $(careerHeading).prop("tagName")?.toLowerCase() ?? "h2";
  // On parcourt les éléments suivants jusqu'à la prochaine section de même niveau
  // (ou plus haut) que le titre de la section carrière, ou jusqu'à la fin.
  const stopTags = new Set(["h1", tagName]);

  $(careerHeading).nextAll().each((_, el) => {
    const $el = $(el);
    const elTag = ($el.prop("tagName") ?? "").toLowerCase();
    if (stopTags.has(elTag)) return false;
    if (!/^h[2-6]$/.test(elTag)) return;

    const title = cleanText($el.text());
    if (isJobTitle(title)) titles.push(title);
  });

  return titles;
}

/** Parse la page carrières de BoreA Canada et retourne une offre par titre trouvé. */
export function parseBoreA(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  for (const title of collectJobTitles($)) {
    const slug = slugify(title);
    const url = `${baseUrl.split("#")[0]}#${slug}`;
    if (seen.has(url)) continue;

    seen.add(url);
    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      tags: [],
    });
  }

  return jobs;
}

export const boreACanadaScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseBoreA(html, baseUrl || CAREERS_URL);
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
    const jobs = parseBoreA(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
