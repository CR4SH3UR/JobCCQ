import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { extractJsonLdJobs } from "./jsonld.js";

/**
 * Fabrique un scraper pour une **page carrières d'entreprise** (employeur) :
 * une seule page liste les postes ouverts. On tente d'abord les données
 * structurées JSON-LD, puis un repli HTML qui cible les liens de fiches de
 * poste. Idéal pour ajouter rapidement un employeur au répertoire.
 *
 * Statut recommandé : `experimental` (les sélecteurs du repli HTML doivent
 * être validés contre le DOM réel de chaque site).
 */
export interface CareersScraperConfig {
  id: string;
  company: string;
  careersUrl: string;
}

function absolute(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function sameUrl(a: string, b: string): boolean {
  return a.replace(/\/+$/, "") === b.replace(/\/+$/, "");
}

const NAV_LABELS =
  /^(carrières|carrieres|postuler|en savoir plus|voir|voir l'offre|accueil|contact|nous joindre|emplois|carrière)$/i;

function parseHtmlCareers(
  html: string,
  baseUrl: string,
  careersUrl: string,
  id: string,
  company: string,
): RawJob[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const jobs: RawJob[] = [];

  $('a[href*="carriere"], a[href*="emploi"], a[href*="poste"], a[href*="/job"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const url = absolute((href.split("#")[0] ?? "").trim(), baseUrl);
    if (sameUrl(url, careersUrl)) return; // ignore la page index elle-même
    if (seen.has(url)) return;

    const title = ($(el).text() || $(el).attr("title") || "").replace(/\s+/g, " ").trim();
    if (!title || title.length < 3 || title.length > 120) return;
    if (NAV_LABELS.test(title)) return;

    seen.add(url);
    jobs.push({ sourceId: id, url, title, company, tags: [] });
  });

  return jobs;
}

export function makeCareersScraper(config: CareersScraperConfig): Scraper {
  return {
    id: config.id,

    parseList(html: string, baseUrl: string): RawJob[] {
      const jsonld = extractJsonLdJobs(html, config.id, baseUrl);
      if (jsonld.length > 0) return jsonld;
      return parseHtmlCareers(html, baseUrl, config.careersUrl, config.id, config.company);
    },

    async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
      ctx.log(`${config.id} — page carrières : ${config.careersUrl}`);
      let html: string;
      try {
        html = await ctx.fetchHtml(config.careersUrl);
      } catch (err) {
        ctx.log(`${config.id} — échec : ${(err as Error).message}`);
        return [];
      }
      const jobs = this.parseList!(html, config.careersUrl);
      ctx.log(`${config.id} — ${jobs.length} poste(s) trouvé(s)`);
      return jobs;
    },
  };
}
