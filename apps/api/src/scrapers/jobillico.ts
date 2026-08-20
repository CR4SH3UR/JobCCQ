import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { extractJsonLdJobs } from "./jsonld.js";
import { absolute, cleanText, deslugify } from "./util.js";

const BASE = "https://www.jobillico.com";
const SOURCE_ID = "jobillico";

/** Nombre max de fiches détaillées récupérées par exécution (politesse). */
const DETAIL_CAP = Number(process.env.JOBILLICO_DETAIL_CAP ?? 30);

interface Listed {
  url: string;
  title: string;
  company: string;
}

/** Retire les paramètres de suivi d'une URL de fiche (id stable). */
function cleanJobUrl(raw: string): string {
  const abs = absolute(BASE, raw);
  const q = abs.indexOf("?");
  return q === -1 ? abs : abs.slice(0, q);
}

/** Déduit l'entreprise depuis le slug d'URL `/job-offer/<entreprise>/<poste>/<id>`. */
function companyFromUrl(url: string): string {
  const m = url.match(/\/job-offer\/([^/]+)\//i);
  return m ? deslugify(decodeURIComponent(m[1]!)) : "";
}

/**
 * Parse la page de résultats : Jobillico expose un JSON-LD `ItemList`
 * dont chaque `ListItem` porte l'URL et le titre d'une offre.
 * Repli : les ancres `/job-offer/…` présentes dans le HTML.
 */
export function parseSearchList(html: string): Listed[] {
  const $ = cheerio.load(html);
  const out = new Map<string, Listed>();

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw.includes("ItemList") && !raw.includes("ListItem")) return;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    const lists = Array.isArray(data) ? data : [data];
    for (const node of lists as Array<Record<string, unknown>>) {
      const items = node?.itemListElement;
      if (!Array.isArray(items)) continue;
      for (const it of items as Array<Record<string, unknown>>) {
        const href = typeof it.url === "string" ? it.url : undefined;
        if (!href || !/\/job-offer\//i.test(href)) continue;
        const url = cleanJobUrl(href);
        const title = cleanText(typeof it.name === "string" ? it.name : "");
        if (!title) continue;
        out.set(url, { url, title, company: companyFromUrl(url) });
      }
    }
  });

  if (out.size === 0) {
    $('a[href*="/job-offer/"]').each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const url = cleanJobUrl(href);
      const title = cleanText($(el).text()) || cleanText($(el).attr("title"));
      if (!title || title.length < 3 || out.has(url)) return;
      out.set(url, { url, title, company: companyFromUrl(url) });
    });
  }

  return [...out.values()];
}

export const jobillicoScraper: Scraper = {
  id: SOURCE_ID,

  /**
   * Sur une fiche : le JSON-LD `JobPosting` (fiable). Sur une page de
   * résultats : l'`ItemList` converti en offres « superficielles ».
   */
  parseList(html: string, baseUrl: string): RawJob[] {
    const jobs = extractJsonLdJobs(html, SOURCE_ID, baseUrl);
    if (jobs.length > 0) return jobs;
    return parseSearchList(html).map((l) => ({
      sourceId: SOURCE_ID,
      url: l.url,
      title: l.title,
      company: l.company || "Entreprise non précisée",
      tags: [],
    }));
  },

  async scrape(params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    const maxPages = params.maxPages ?? 3;
    const kw = params.query ? encodeURIComponent(params.query) : "";
    const loc = params.location ? `/${encodeURIComponent(params.location.toLowerCase())}` : "";

    // 1) Collecte des liens d'offres depuis l'ItemList des pages de résultats.
    const listed = new Map<string, Listed>();
    for (let page = 1; page <= maxPages; page++) {
      const url = `${BASE}/search-jobs${loc}?skwd=${kw}&page=${page}`;
      ctx.log(`Jobillico — page ${page} : ${url}`);
      let html: string;
      try {
        html = await ctx.fetchHtml(url);
      } catch (err) {
        ctx.log(`Jobillico — arrêt page ${page} : ${(err as Error).message}`);
        break;
      }
      const items = parseSearchList(html);
      ctx.log(`Jobillico — ${items.length} offres listées sur la page ${page}`);
      if (items.length === 0) break;
      let fresh = 0;
      for (const it of items) if (!listed.has(it.url)) (listed.set(it.url, it), fresh++);
      if (fresh === 0) break; // page identique → fin de pagination
    }

    // 2) Enrichissement : on récupère les fiches (JSON-LD JobPosting) jusqu'au plafond.
    const results: RawJob[] = [];
    let fetched = 0;
    for (const l of listed.values()) {
      const shallow: RawJob = {
        sourceId: SOURCE_ID,
        url: l.url,
        title: l.title,
        company: l.company || "Entreprise non précisée",
        tags: [],
      };
      if (fetched >= DETAIL_CAP) {
        results.push(shallow);
        continue;
      }
      fetched++;
      try {
        const detailHtml = await ctx.fetchHtml(l.url);
        const detail = extractJsonLdJobs(detailHtml, SOURCE_ID, l.url);
        results.push(detail[0] ? { ...detail[0], url: l.url } : shallow);
      } catch (err) {
        ctx.log(`Jobillico — fiche ignorée (${(err as Error).message})`);
        results.push(shallow);
      }
    }

    ctx.log(`Jobillico — ${results.length} offres (${fetched} fiches détaillées)`);
    return results;
  },
};
