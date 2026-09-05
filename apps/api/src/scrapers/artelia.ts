import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText } from "./util.js";

/**
 * Scraper dédié à Artelia Canada (portail Attrax sur
 * careers.arteliagroup.com). Chaque poste est un lien
 * `/canada-fr/job/<slug>-in-<ville>-jid-<id>` répété (titre + « En savoir plus »).
 * Attrax plafonne à 48 résultats par page : `size=480` est ignoré et ne ramène
 * que la première page — d'où la pagination `page=N&size=48`. Les `options`
 * gardent le filtre métiers du portail Canada.
 */
const LIST = "https://careers.arteliagroup.com/canada-fr/jobs";
const OPTIONS =
  "412,438,439,479,455,440,405,404,403,396,482,458,414,432,410,456,399,397,435,395";
/** Maximum réellement honoré par Attrax (12 / 24 / 48). */
const PAGE_SIZE = 48;
const MAX_PAGES = 20;
const COMPANY = "Artelia Canada inc.";

function listPageUrl(page: number): string {
  const u = new URL(LIST);
  u.searchParams.set("options", OPTIONS);
  u.searchParams.set("page", String(page));
  u.searchParams.set("size", String(PAGE_SIZE));
  return u.toString();
}

/** « baie-comeau » → « Baie-Comeau » (on garde les tirets pour detectRegion). */
function deslugCity(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join("-");
}

/** Ville = segment après le dernier `-in-` avant `-jid-` (évite fly-in-fly-out). */
function cityFromHref(href: string): string | undefined {
  const path = (href.split("?")[0] ?? href).replace(/\/$/, "");
  const beforeJid = path.split(/-jid-/i)[0] ?? "";
  const slug = beforeJid.match(/.*-in-([a-z0-9-]+)$/i)?.[1];
  return slug ? deslugCity(slug) : undefined;
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
        const location = cityFromHref(href);
        out.set(url, {
          sourceId: "arteliagroup-com",
          url,
          title: isFiller ? "" : text,
          company: COMPANY,
          ...(location ? { location } : {}),
          tags: [],
        });
      } else if (!existing.title && !isFiller) {
        existing.title = text;
      }
    }
    return [...out.values()].filter((j) => j.title);
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    const byUrl = new Map<string, RawJob>();
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = listPageUrl(page);
      ctx.log(`arteliagroup-com — page ${page} : ${url}`);
      let html: string;
      try {
        html = await ctx.fetchHtml(url);
      } catch (err) {
        ctx.log(`arteliagroup-com — échec page ${page} : ${(err as Error).message}`);
        if (page === 1) return [];
        break;
      }
      const batch = this.parseList!(html, url);
      let added = 0;
      for (const job of batch) {
        if (byUrl.has(job.url)) continue;
        byUrl.set(job.url, job);
        added++;
      }
      ctx.log(`arteliagroup-com — page ${page} : ${batch.length} poste(s), ${added} nouveau(x)`);
      if (added === 0 || batch.length < PAGE_SIZE) break;
    }
    const jobs = [...byUrl.values()];
    ctx.log(`arteliagroup-com — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.(false);
    return jobs;
  },
};
