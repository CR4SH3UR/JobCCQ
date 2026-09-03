import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText } from "./util.js";

/**
 * Scraper dédié à Groupe Intermat (intermat.ca) : listing « carrières » maison
 * où chaque poste est une carte `<a href="/carrieres/detail/<titre>/<id>">` avec
 * `<h3>` (titre), `<h4>` (lieu), `.rate` (taux horaire) et un `<small>` daté.
 * Le repli générique captait tout le texte de la carte comme titre
 * (« Voir détails <titre> <lieu> Mise en ligne le… <salaire>$ ») — d'où ce
 * parseur ciblé qui isole proprement chaque champ.
 */
const CAREERS = "https://www.intermat.ca/carrieres";
const COMPANY = "Groupe Intermat inc.";

function parseRate(s: string): number | undefined {
  const m = s.replace(/\s/g, "").match(/(\d{1,3})[.,](\d{2})/);
  return m ? Number(`${m[1]}.${m[2]}`) : undefined;
}

function parseFrDate(s: string): string | undefined {
  const m = s.match(/(\d{2})-(\d{2})-(\d{4})/); // JJ-MM-AAAA
  if (!m) return undefined;
  const t = Date.parse(`${m[3]}-${m[2]}-${m[1]}`);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

export const intermatScraper: Scraper = {
  id: "intermat-ca",
  parseList(html: string, baseUrl: string): RawJob[] {
    const $ = cheerio.load(html);
    const out = new Map<string, RawJob>();
    $('a[href*="/carrieres/detail/"]').each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const url = absolute(baseUrl, href.split("?")[0]!);
      const card = $(el);
      const title = cleanText(card.find("h3").first().text());
      if (!title) return;
      const rate = parseRate(card.find(".rate").first().text());
      const posted = parseFrDate(card.find("small").first().text());
      out.set(url, {
        sourceId: "intermat-ca",
        url,
        title,
        company: COMPANY,
        location: cleanText(card.find("h4").first().text()) || undefined,
        ...(rate ? { salaryMin: rate, salaryMax: rate, salaryPeriod: "heure" as const } : {}),
        ...(posted ? { postedAt: posted } : {}),
        tags: [],
      });
    });
    return [...out.values()];
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`intermat-ca — page carrières : ${CAREERS}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS);
    } catch (err) {
      ctx.log(`intermat-ca — échec : ${(err as Error).message}`);
      return [];
    }
    const jobs = this.parseList!(html, CAREERS);
    ctx.log(`intermat-ca — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.(false);
    return jobs;
  },
};
