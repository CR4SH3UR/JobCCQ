import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, parseFrenchDate } from "./util.js";

/**
 * Scraper générique pour un portail carrières **Avature**
 * (ex. jobs.<entreprise>.ca). Le endpoint `…/Jobs/SearchJobs` renvoie un
 * fragment HTML de cartes d'offres, paginé via `?jobOffset=` (pas = pageSize).
 */
export interface AvatureConfig {
  id: string;
  company: string;
  /** Endpoint de recherche, ex. https://jobs.x.ca/fr_CA/Jobs/SearchJobs */
  searchUrl: string;
  /** Plafond d'offres récupérées (portails volumineux → politesse). */
  maxJobs?: number;
  /** Nombre d'offres par page (défaut Avature : 6). */
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 6;

// Avature renvoie une page « anti-robot » sans offres aux UA identifiables ;
// on présente donc un UA navigateur classique pour ce portail public.
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Parse un fragment de résultats Avature (cartes `article.article--result`). */
export function parseAvature(html: string, id: string, company: string): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $("article.article--result").each((_, el) => {
    const $a = $(el);
    const $link = $a.find(".article__header__text__title a, h3 a.link").first();
    const href = $link.attr("href");
    if (!href) return;
    const url = href.split("?")[0]!;
    if (seen.has(url)) return;

    let title = cleanText($link.text());
    if (!title) {
      // Repli : le titre figure dans le sujet du lien « partager par courriel ».
      const mailto = $a.find('a[href^="mailto:"]').attr("href") ?? "";
      const subject = decodeURIComponent((mailto.match(/subject=([^&]*)/)?.[1] ?? "").replace(/\+/g, " "));
      title = cleanText(subject.replace(/\s*[-–]\s*[^-–]*careers?\s*$/i, ""));
    }
    if (!title) return;

    const location = cleanText($a.find(".list-item-location").first().text());
    const posted = cleanText($a.find(".list-item-posted").first().text()).replace(/^Publi[ée]\s*/i, "");

    seen.add(url);
    jobs.push({
      sourceId: id,
      url,
      title,
      company,
      location: location || undefined,
      postedAt: parseFrenchDate(posted),
      tags: [],
    });
  });

  return jobs;
}

export function makeAvatureScraper(config: AvatureConfig): Scraper {
  const pageSize = config.pageSize ?? DEFAULT_PAGE_SIZE;
  return {
    id: config.id,
    parseList(html: string): RawJob[] {
      return parseAvature(html, config.id, config.company);
    },
    async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
      const maxJobs = config.maxJobs ?? Number(process.env.AVATURE_MAX_JOBS ?? 60);
      const all = new Map<string, RawJob>();

      for (let offset = 0; all.size < maxJobs; offset += pageSize) {
        const url = `${config.searchUrl}?jobOffset=${offset}`;
        ctx.log(`${config.id} — offset ${offset}`);
        let html: string;
        try {
          html = await ctx.fetchHtml(url, { userAgent: BROWSER_UA });
        } catch (err) {
          ctx.log(`${config.id} — arrêt (offset ${offset}) : ${(err as Error).message}`);
          break;
        }
        const found = parseAvature(html, config.id, config.company);
        if (found.length === 0) break;
        let fresh = 0;
        for (const job of found) if (!all.has(job.url)) (all.set(job.url, job), fresh++);
        if (fresh === 0) break; // page identique → fin de pagination
        if (found.length < pageSize) break; // dernière page
      }

      const list = [...all.values()].slice(0, maxJobs);
      ctx.log(`${config.id} — ${list.length} poste(s) retenus`);
      return list;
    },
  };
}
