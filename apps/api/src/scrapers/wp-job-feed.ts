import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, mapEmploymentType, parseFrenchDate } from "./util.js";

/**
 * Scraper générique pour un flux RSS WordPress de type d'article « emploi »
 * (souvent `…/job/feed/`). Les postes n'apparaissent pas dans le HTML de la
 * page carrières (chargés en AJAX), mais le flux RSS les liste avec titre,
 * lien, date et une série de `<category>` (taxonomies) qui mélangent lieu,
 * type de poste et département. On les répartit par heuristique.
 */
export interface WpJobFeedConfig {
  id: string;
  company: string;
  /** URL du flux, ex. https://ebcinc.com/fr/job/feed/ (pagination ?paged=N). */
  feedUrl: string;
  maxPages?: number;
}

/** Termes de catégorie qui désignent un type de poste. */
const TYPE_TERM =
  /permanent|temporaire|contractuel|contrat|stage|temps\s*plein|temps\s*partiel|saisonnier|[ée]tudiant|occasionnel|pige/i;

/** Termes de catégorie qui désignent un lieu (villes QC / Canada courantes). */
const PLACE_TERM =
  /montr[ée]al|qu[ée]bec|brossard|laval|longueuil|gatineau|sherbrooke|trois-rivi[èe]res|saguenay|chicoutimi|jonqui[èe]re|l[ée]vis|sept-[îi]les|baie-comeau|fermont|malartic|rouyn|noranda|val-d'?or|amos|granby|drummondville|victoriaville|rimouski|matane|joliette|terrebonne|repentigny|saint-j[ée]r[ôo]me|mirabel|ottawa|toronto|vancouver|calgary|edmonton|winnipeg|mississauga|hamilton|halifax|moncton|r[ée]gion/i;

/** Parse un flux RSS d'emplois WordPress en offres brutes. */
export function parseWpJobFeed(xml: string, id: string, company: string): RawJob[] {
  const $ = cheerio.load(xml, { xml: true });
  const jobs: RawJob[] = [];

  $("item").each((_, el) => {
    const $it = $(el);
    const title = cleanText($it.find("title").first().text());
    const url = cleanText($it.find("link").first().text()).split("?")[0];
    if (!title || !url) return;

    const cats = $it
      .find("category")
      .map((_, c) => cleanText($(c).text()))
      .get()
      .filter(Boolean);

    const places = cats.filter((c) => PLACE_TERM.test(c));
    const typeTerm = cats.find((c) => TYPE_TERM.test(c));

    jobs.push({
      sourceId: id,
      url,
      title,
      company,
      location: places.length ? places.join(", ") : undefined,
      employmentType: mapEmploymentType(typeTerm),
      postedAt: parseFrenchDate($it.find("pubDate").first().text()),
      // Toutes les catégories en tags : les départements (Civil, Communications…)
      // aident le classement par domaine.
      tags: cats,
    });
  });

  return jobs;
}

export function makeWpJobFeedScraper(config: WpJobFeedConfig): Scraper {
  return {
    id: config.id,
    parseList(xml: string): RawJob[] {
      return parseWpJobFeed(xml, config.id, config.company);
    },
    async scrape(params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
      const maxPages = params.maxPages ?? config.maxPages ?? 8;
      const sep = config.feedUrl.includes("?") ? "&" : "?";
      const all = new Map<string, RawJob>();

      for (let page = 1; page <= maxPages; page++) {
        const url = page === 1 ? config.feedUrl : `${config.feedUrl}${sep}paged=${page}`;
        ctx.log(`${config.id} — flux page ${page} : ${url}`);
        let xml: string;
        try {
          xml = await ctx.fetchHtml(url);
        } catch (err) {
          ctx.log(`${config.id} — arrêt page ${page} : ${(err as Error).message}`);
          break;
        }
        const found = parseWpJobFeed(xml, config.id, config.company);
        let fresh = 0;
        for (const job of found) if (!all.has(job.url)) (all.set(job.url, job), fresh++);
        ctx.log(`${config.id} — page ${page} : ${found.length} items, ${fresh} nouveaux`);
        // Le flux peut se répéter/paginer de façon imparfaite : on s'arrête dès
        // qu'une page n'apporte plus rien de neuf.
        if (found.length === 0 || fresh === 0) break;
      }

      ctx.log(`${config.id} — ${all.size} poste(s) trouvé(s)`);
      return [...all.values()];
    },
  };
}
