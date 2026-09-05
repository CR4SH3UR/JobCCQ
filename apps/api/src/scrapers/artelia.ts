import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText } from "./util.js";

/**
 * Scraper dédié à Artelia Canada (portail carrières maison sur
 * careers.arteliagroup.com). Chaque poste est un lien
 * `/canada-fr/job/<slug>-in-<ville>-jid-<id>` répété plusieurs fois (titre +
 * boutons « En savoir plus »). Le repli générique s'y perdait (il captait
 * « En savoir plus » comme titre) — d'où ce parseur qui isole le vrai intitulé
 * et déduit la ville depuis le slug. Les `options` gardent le filtre métiers
 * choisi dans le portail ; `size=480` ramène toutes les offres sur une seule
 * page (pas de pagination).
 */
const CAREERS =
  "https://careers.arteliagroup.com/canada-fr/jobs?options=412%2C438%2C439%2C479%2C455%2C440%2C405%2C404%2C403%2C396%2C482%2C458%2C414%2C432%2C410%2C456%2C399%2C397%2C435%2C395&page=1&size=480";
const COMPANY = "Artelia Canada inc.";

/** « baie-comeau » → « Baie-Comeau » (on garde les tirets pour detectRegion). */
function deslugCity(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join("-");
}

export const arteliaScraper: Scraper = {
  id: "arteliagroup-com",
  parseList(html: string, baseUrl: string): RawJob[] {
    const re = /<a[^>]+href="(\/canada-fr\/job\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const out = new Map<string, RawJob>();
    for (const m of html.matchAll(re)) {
      const href = m[1]!;
      const text = cleanText(m[2]!.replace(/<[^>]+>/g, " "));
      const url = absolute(baseUrl, href);
      const isFiller = !text || /^(en savoir plus|postuler|apply|voir l['’]offre)$/i.test(text);
      const existing = out.get(url);
      if (!existing) {
        // Ville depuis le slug : « …-in-<ville>-jid-<id> ».
        const citySlug = href.match(/-in-([a-z0-9-]+)-jid-\d+/i)?.[1];
        out.set(url, {
          sourceId: "arteliagroup-com",
          url,
          title: isFiller ? "" : text,
          company: COMPANY,
          ...(citySlug ? { location: deslugCity(citySlug) } : {}),
          tags: [],
        });
      } else if (!existing.title && !isFiller) {
        existing.title = text; // on complète le titre si on ne l'avait pas encore
      }
    }
    return [...out.values()].filter((j) => j.title);
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`arteliagroup-com — page carrières : ${CAREERS}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS);
    } catch (err) {
      ctx.log(`arteliagroup-com — échec : ${(err as Error).message}`);
      return [];
    }
    const jobs = this.parseList!(html, CAREERS);
    ctx.log(`arteliagroup-com — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.(false);
    return jobs;
  },
};
