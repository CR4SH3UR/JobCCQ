import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * Galilée Construction (galileeconstruction.com/careers) — site Framer.
 *
 * Les vrais postes sont les titres **`h3`** de la section « Emplois Disponibles »
 * (rendus en double par Framer : variantes bureau/mobile). Le scraper générique
 * ajoutait à tort « Apprentissage » — un en-tête `h5` de la section « culture »
 * qui matchait le mot-clé « apprenti ». Ce parseur ne garde que les `h3`
 * (dédoublonnés), donc uniquement les vrais postes.
 */
const ID = "galileeconstruction-com";
const COMPANY = "Galilée Construction inc.";
const CAREERS_URL = "https://www.galileeconstruction.com/careers";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const NOT_A_JOB =
  /^(emplois?\s+disponibles?|carri[èe]res?|nos\s+valeurs|flexibilit|environnement|apprentissage|avantages?|navigation|nous\s+joindre)/i;

/** Parse les titres de postes (`h3` de la section « Emplois Disponibles »). */
export function parseGalilee(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const base = baseUrl.replace(/#.*$/, "").replace(/\/+$/, "");
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $("h3").each((_, el) => {
    const title = cleanText($(el).text());
    if (!title || title.length < 3 || title.length > 90 || NOT_A_JOB.test(title)) return;
    const slug = slugify(title);
    if (!slug || seen.has(slug)) return; // Framer double les titres (bureau/mobile)
    seen.add(slug);
    jobs.push({ sourceId: ID, url: `${base}#${slug}`, title, company: COMPANY, tags: [] });
  });

  return jobs;
}

export const galileeScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseGalilee(html, baseUrl || CAREERS_URL);
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL, { userAgent: BROWSER_UA });
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseGalilee(html, CAREERS_URL);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    return jobs;
  },
};
