import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { extractJsonLdJobs } from "./jsonld.js";

export interface JsonLdScraperConfig {
  id: string;
  /** Construit l'URL d'une page de résultats. */
  buildUrl: (params: ScrapeParams, page: number) => string;
  defaultMaxPages?: number;
}

/**
 * Fabrique un scraper qui s'appuie sur les données structurées JSON-LD
 * exposées par la source. Idéal pour démarrer une nouvelle source : il suffit
 * de fournir le patron d'URL de recherche.
 */
export function makeJsonLdScraper(config: JsonLdScraperConfig): Scraper {
  return {
    id: config.id,
    parseList(html, baseUrl) {
      return extractJsonLdJobs(html, config.id, baseUrl);
    },
    async scrape(params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
      const maxPages = params.maxPages ?? config.defaultMaxPages ?? 3;
      const all = new Map<string, RawJob>();
      for (let page = 1; page <= maxPages; page++) {
        const url = config.buildUrl(params, page);
        ctx.log(`${config.id} — page ${page} : ${url}`);
        let html: string;
        try {
          html = await ctx.fetchHtml(url);
        } catch (err) {
          ctx.log(`${config.id} — arrêt page ${page} : ${(err as Error).message}`);
          break;
        }
        const found = extractJsonLdJobs(html, config.id, url);
        ctx.log(`${config.id} — ${found.length} offres sur la page ${page}`);
        if (found.length === 0) break;
        for (const job of found) all.set(job.url, job);
      }
      return [...all.values()];
    },
  };
}
