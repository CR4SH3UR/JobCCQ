import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * Scraper dédié à Ascenseurs Absolu (site Duda). Les postes ne sont ni des
 * liens ni du JSON-LD : c'est une simple liste `<ul><li>…</li></ul>` sous le
 * titre « Postes disponibles » de la page /contact. Le repli générique ne
 * trouvait donc rien. On extrait chaque `<li>` comme un poste ; la candidature
 * se fait via le formulaire de la même page (URL = page carrières + ancre).
 */
const CAREERS = "https://www.ascenseursabsolu.com/contact";
const COMPANY = "Ascenseurs Absolu";

/** Décode les entités HTML françaises courantes présentes dans le markup Duda. */
function decode(s: string): string {
  return s
    .replace(/&eacute;/gi, "é")
    .replace(/&egrave;/gi, "è")
    .replace(/&ecirc;/gi, "ê")
    .replace(/&euml;/gi, "ë")
    .replace(/&agrave;/gi, "à")
    .replace(/&acirc;/gi, "â")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&ocirc;/gi, "ô")
    .replace(/&oelig;/gi, "œ")
    .replace(/&icirc;/gi, "î")
    .replace(/&iuml;/gi, "ï")
    .replace(/&ucirc;/gi, "û")
    .replace(/&ugrave;/gi, "ù")
    .replace(/&rsquo;/gi, "’")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export const ascenseursAbsoluScraper: Scraper = {
  id: "ascenseursabsolu-com",
  parseList(html: string): RawJob[] {
    const start = html.search(/Postes?\s+disponibles/i);
    if (start < 0) return [];
    // Première liste <ul> qui suit le titre « Postes disponibles ».
    const ul = html.slice(start).match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
    if (!ul) return [];
    const out = new Map<string, RawJob>();
    for (const m of ul[1]!.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
      const title = cleanText(decode(m[1]!.replace(/<[^>]+>/g, " ")));
      if (title.length < 2) continue;
      const url = `${CAREERS}#${slugify(title) || "poste"}`;
      out.set(url, { sourceId: "ascenseursabsolu-com", url, title, company: COMPANY, location: "Laval", tags: [] });
    }
    return [...out.values()];
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`ascenseursabsolu-com — page carrières : ${CAREERS}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS);
    } catch (err) {
      ctx.log(`ascenseursabsolu-com — échec : ${(err as Error).message}`);
      return [];
    }
    const jobs = this.parseList!(html, CAREERS);
    ctx.log(`ascenseursabsolu-com — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.(false);
    return jobs;
  },
};
