import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, mapEmploymentType, slugify } from "./util.js";

/**
 * G.L.R. inc. (glrinc.ca) — génie civil / lignes de transport électrique.
 *
 * La découverte avait routé GLR vers le portail Zoho **partagé** d'EBC
 * (ebcinc.zohorecruit.com) — qui liste les offres de tout le groupe, pas celles
 * de GLR. Or GLR affiche ses **propres** postes sur sa page carrières
 * (WordPress/Elementor) : chaque poste est un titre suivi d'un intitulé de type
 * « Permanent | Chantier ». On lit donc directement cette page.
 *
 * Une offre = un titre (heading) immédiatement suivi d'un heading « <type> |
 * <lieu> » (Permanent, Temporaire, Stage…). « Candidature spontanée » est écartée.
 */
const ID = "glr-qc-ca";
const COMPANY = "G.L.R. inc.";
const CAREERS_URL = "https://glrinc.ca/carrieres/";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Intitulé de type d'emploi (le heading qui suit le titre d'un vrai poste).
const TYPE_HEADING =
  /^(permanent|temporaire|contractuel|contrat|stage|saisonnier|occasionnel|temps\s+(?:plein|partiel))\b/i;

/** Parse les cartes de postes (titre suivi d'un heading « type | lieu »). */
export function parseGlr(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const base = baseUrl.replace(/#.*$/, "").replace(/\/+$/, "");
  const headings = $(".elementor-heading-title").toArray().map((el) => cleanText($(el).text()));

  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < headings.length - 1; i++) {
    const title = headings[i]!;
    const next = headings[i + 1]!;
    if (!TYPE_HEADING.test(next)) continue; // le suivant n'est pas un « type » → pas un poste
    if (TYPE_HEADING.test(title)) continue; // le titre est lui-même un « type » → ignore
    if (/candidature\s+spontan/i.test(title)) continue; // pas une vraie offre
    if (title.length < 3 || title.length > 120) continue;
    const slug = slugify(title);
    if (seen.has(slug)) continue;
    seen.add(slug);
    jobs.push({
      sourceId: ID,
      url: `${base}/#${slug}`,
      title,
      company: COMPANY,
      employmentType: mapEmploymentType(next),
      tags: [],
    });
  }
  return jobs;
}

export const glrScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseGlr(html, baseUrl || CAREERS_URL);
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL, { userAgent: BROWSER_UA });
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseGlr(html, CAREERS_URL);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    return jobs;
  },
};
