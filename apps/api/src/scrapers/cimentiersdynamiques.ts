import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText } from "./util.js";

/**
 * Cimentiers Dynamiques inc. — page Themify `/index.php/carriere/`.
 * Trois cartes (image + `h3.image-title` + bouton « postulez ») : journaliers,
 * chauffeurs camions-bennes, chauffeurs bétonnières. Les deux titres chauffeur
 * sont identiques : la légende (`.image-caption`) les distingue.
 * Pas de JSON-LD JobPosting ; les pages « postulez » sont des formulaires.
 */
const ID = "cimentiersdynamiques-com";
const COMPANY = "Cimentiers Dynamiques inc.";
const CAREERS_URL = "https://cimentiersdynamiques.com/index.php/carriere/";
const LOCATION = "Saint-Jérôme, QC";

/** « JOURNALIERS / JOURNALIÈRES » → « Journaliers / Journalières ». */
function unshout(s: string): string {
  const t = cleanText(s);
  if (!t) return t;
  const letters = t.replace(/[^\p{L}]/gu, "");
  if (!letters || letters !== letters.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

function cardTitle(raw: string, caption: string): string {
  const title = unshout(raw);
  const cap = unshout(caption);
  if (!cap) return title;
  if (title.toLowerCase().includes(cap.toLowerCase())) return title;
  return `${title} — ${cap}`;
}

/** Parseur PUR : cartes Themify « NOS OFFRES D'EMPLOIS » → offres. */
export function parseCimentiersDynamiques(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  // Chaque carte = `.module-image` (titre + légende) + bouton frère.
  // Ne pas partir de `.module_column` : la colonne pleine largeur englobe
  // les 3 cartes et volerait la légende du voisin.
  $(".module-image").each((_, el) => {
    const $img = $(el);
    const raw = cleanText($img.find("h3.image-title").first().text());
    if (!raw || raw.length < 4) return;

    const href = ($img.nextAll().find("a.builder_button").first().attr("href") ?? "").trim();
    if (!href || href.startsWith("#")) return;
    const url = absolute(baseUrl, href).split("#")[0]!;
    if (seen.has(url)) return;
    seen.add(url);

    const caption = cleanText($img.find(".image-caption").first().text());
    jobs.push({
      sourceId: ID,
      url,
      title: cardTitle(raw, caption),
      company: COMPANY,
      location: LOCATION,
      tags: [],
    });
  });

  return jobs;
}

export const cimentiersDynamiquesScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseCimentiersDynamiques(html, baseUrl || CAREERS_URL),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL);
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseCimentiersDynamiques(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
