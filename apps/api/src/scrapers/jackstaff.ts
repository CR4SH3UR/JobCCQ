import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, deslugify } from "./util.js";

/**
 * Scraper pour une page employeur **Jack Staff** (jackstaff.ca), plateforme de
 * recrutement construction du Québec. Les postes sont des liens
 * `…/opportunite-d-emploi/<entreprise>/<titre-slug>/<id>`. On les lit et on
 * dérive le titre propre depuis le segment d'URL.
 */
export interface JackStaffConfig {
  id: string;
  company: string;
  /** URL de la page employeur (…/voir-entreprise/<nom>/<id>/). */
  listUrl: string;
}

const OPP_RE = /\/opportunite-d-emploi\/[^/]+\/([^/]+)\/(\d+)/i;

export function parseJackStaff(html: string, cfg: JackStaffConfig): RawJob[] {
  const $ = cheerio.load(html);
  const byId = new Map<string, RawJob>();

  $('a[href*="/opportunite-d-emploi/"]').each((_, a) => {
    const href = $(a).attr("href") || "";
    const m = href.match(OPP_RE);
    if (!m) return;
    const jobId = m[2]!;
    if (byId.has(jobId)) return;
    // Titre : d'abord le segment d'URL (propre), repli sur le texte du lien.
    const fromSlug = deslugify(decodeURIComponent(m[1]!));
    const fromText = cleanText($(a).text()).split("\n")[0] ?? "";
    const title = fromSlug.length >= 4 ? fromSlug : fromText;
    if (!title || title.length < 4) return;
    let url: string;
    try {
      url = new URL(href, cfg.listUrl).toString();
    } catch {
      url = href;
    }
    byId.set(jobId, { sourceId: cfg.id, url, title, company: cfg.company, tags: [] });
  });

  return [...byId.values()];
}

export function makeJackStaffScraper(config: JackStaffConfig): Scraper {
  return {
    id: config.id,
    parseList(html: string): RawJob[] {
      return parseJackStaff(html, config);
    },
    async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
      ctx.log(`${config.id} — page Jack Staff : ${config.listUrl}`);
      let html: string;
      try {
        html = await ctx.fetchHtml(config.listUrl);
      } catch (err) {
        ctx.log(`${config.id} — échec : ${(err as Error).message}`);
        return [];
      }
      const jobs = parseJackStaff(html, config);
      ctx.log(`${config.id} — ${jobs.length} poste(s) trouvé(s)`);
      return jobs;
    },
  };
}
