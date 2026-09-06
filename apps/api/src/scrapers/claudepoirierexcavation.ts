import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText, slugify } from "./util.js";

/**
 * Claude Poirier Excavation inc. — page Wix `/carrières`.
 * Les postes ouverts sont listés sous « POSTE(S) DISPONIBLE(S) » :
 *   - un bouton `a[data-anchor]` vers `#anchorN` (table des matières)
 *   - un `<h5>` du même intitulé plus bas (fiche détaillée)
 * On déduplique sur le slug et on préfère le titre H5 (plus complet).
 * UA navigateur obligatoire (403 sinon, Wix/Cloudflare).
 */
const ID = "claudepoirierexcavation-com";
const COMPANY = "Claude Poirier Excavation inc.";
const CAREERS_URL = "https://www.claudepoirierexcavation.com/carrières";
const LOCATION = "Saint-Jean-Baptiste, QC";
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const SECTION_LABEL =
  /^(poste\(s\)\s+disponible|postes?\s+disponibles?|candidature\s+spontan|[àa]\s+propos|nos services|contactez[- ]nous|carri[eè]res|joignez-vous)/i;

function isJobTitle(title: string): boolean {
  return title.length >= 4 && title.length <= 120 && !SECTION_LABEL.test(title);
}

function titleKey(title: string): string {
  return slugify(title);
}

/** Parseur PUR : TOC Wix + titres H5 → offres. */
export function parseClaudePoirierExcavation(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const base = baseUrl.split("#")[0]!;
  const byKey = new Map<string, RawJob>();

  const upsert = (title: string, href?: string) => {
    const clean = cleanText(title);
    if (!isJobTitle(clean)) return;
    const key = titleKey(clean);
    if (!key) return;
    const url = href
      ? absolute(base, href)
      : `${base}#${key}`;
    const prev = byKey.get(key);
    // Le H5 est souvent en majuscules et plus complet que le bouton TOC.
    const keepTitle = !prev || clean.length > prev.title.length;
    byKey.set(key, {
      sourceId: ID,
      url: prev?.url && prev.url.includes("#anchor") ? prev.url : url,
      title: keepTitle ? clean : prev.title,
      company: COMPANY,
      location: LOCATION,
      tags: [],
    });
  };

  $('a[data-anchor][href*="#"]').each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    const title = cleanText($(el).attr("aria-label") || $(el).text());
    if (!href || !/#anchor/i.test(href)) return;
    upsert(title, href);
  });

  $("h5").each((_, el) => {
    upsert($(el).text());
  });

  return [...byKey.values()];
}

export const claudePoirierExcavationScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseClaudePoirierExcavation(html, baseUrl || CAREERS_URL),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL, { userAgent: BROWSER_UA });
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseClaudePoirierExcavation(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
