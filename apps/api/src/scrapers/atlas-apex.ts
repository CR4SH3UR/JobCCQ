import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * Scraper dédié à Atlas-Apex Roofing (Québec) inc. La page /fr/careers/ liste
 * dans un même tableau TOUTES les offres du Canada (`<tr class="result"
 * data-location="…">`), filtrables par ville via un menu déroulant. On ne garde
 * que les postes du Québec : `data-location="6"` correspond à **Montréal, QC**
 * (les autres valeurs sont des villes hors-Québec : Toronto, Ottawa, Calgary…).
 * Chaque ligne porte l'intitulé et la description complète du poste ; la
 * candidature se fait par courriel (aucune page de détail par poste).
 */
const CAREERS = "https://www.atlas-apex.com/fr/careers/";
const COMPANY = "Atlas-Apex Roofing (Québec) inc.";
const QC_LOCATION = "6"; // data-location de Montréal, QC

/** Décode les entités HTML présentes dans le markup WordPress. */
function decode(s: string): string {
  return s
    .replace(/&#0?39;|&#8217;|&rsquo;|&#x27;/gi, "’")
    .replace(/&#8211;|&ndash;/gi, "–")
    .replace(/&#8212;|&mdash;/gi, "—")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, " ");
}

/** Convertit le HTML d'une cellule description en texte lisible (paragraphes conservés). */
function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h[1-6]|ul|ol|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  return decode(withBreaks.replace(/<[^>]+>/g, " "))
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export const atlasApexScraper: Scraper = {
  id: "atlas-apex-com",
  parseList(html: string): RawJob[] {
    const out = new Map<string, RawJob>();
    for (const row of html.matchAll(
      /<tr class="result[^"]*"[^>]*data-location="(\d+)"[^>]*>([\s\S]*?)<\/tr>/gi,
    )) {
      if (row[1] !== QC_LOCATION) continue;
      // Colonnes du tableau : Type | Location | Position Title | Description
      const tds = [...row[2]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]!);
      const title = cleanText(decode((tds[2] ?? "").replace(/<[^>]+>/g, " ")));
      if (title.length < 2) continue;
      const description = htmlToText(tds[3] ?? "");
      const url = `${CAREERS}#${slugify(title) || "poste"}`;
      out.set(url, {
        sourceId: "atlas-apex-com",
        url,
        title,
        company: COMPANY,
        location: "Montréal, QC",
        ...(description ? { description } : {}),
        tags: [],
      });
    }
    return [...out.values()];
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`atlas-apex-com — page carrières : ${CAREERS}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS);
    } catch (err) {
      ctx.log(`atlas-apex-com — échec : ${(err as Error).message}`);
      return [];
    }
    const jobs = this.parseList!(html, CAREERS);
    ctx.log(`atlas-apex-com — ${jobs.length} poste(s) Québec (Montréal) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.(false);
    return jobs;
  },
};
