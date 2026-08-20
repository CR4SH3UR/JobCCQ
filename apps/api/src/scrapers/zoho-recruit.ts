import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { htmlToText } from "./jsonld.js";
import { cleanText } from "./util.js";

/**
 * Scraper générique pour un portail carrières **Zoho Recruit**.
 *
 * La page `…/jobs/<Page>` est une application JS (les offres ne sont pas dans
 * le HTML), mais Zoho expose un **flux RSS** `…/jobs/<Page>/rss` qui liste les
 * postes publiés avec titre, lien, lieu et catégorie. On s'appuie dessus.
 */
export interface ZohoRecruitConfig {
  id: string;
  company: string;
  /** URL du flux RSS carrières, ex. https://x.zohorecruit.com/jobs/Careers/rss */
  rssUrl: string;
}

/** Normalise l'URL d'une offre (encodage des accents, sans paramètres de suivi). */
function cleanUrl(raw: string): string | undefined {
  const noQuery = cleanText(raw).split("?")[0];
  if (!noQuery) return undefined;
  try {
    return new URL(noQuery).toString();
  } catch {
    return noQuery;
  }
}

/** Parse un flux RSS carrières Zoho en offres brutes. */
export function parseZohoRss(xml: string, id: string, company: string): RawJob[] {
  const $ = cheerio.load(xml, { xml: true });
  const jobs: RawJob[] = [];

  $("item").each((_, el) => {
    const $it = $(el);
    const title = cleanText($it.find("title").first().text());
    const url = cleanUrl($it.find("link").first().text());
    if (!title || !url) return;

    const rawDesc = $it.find("description").first().text();
    const location = cleanText(
      (rawDesc.match(/Lieu\s*:\s*(.*?)\s*<br/i)?.[1] ?? "").replace(/<[^>]+>/g, ""),
    );
    const category = cleanText(rawDesc.match(/Cat[ée]gorie\s*:\s*(.*?)\s*<br/i)?.[1] ?? "");

    // Corps de l'annonce : le bloc #spandesc si présent, sinon tout le texte.
    const $desc = cheerio.load(`<div>${rawDesc}</div>`);
    const bodyHtml = $desc("#spandesc").html() ?? "";
    const description = htmlToText(bodyHtml || rawDesc);

    jobs.push({
      sourceId: id,
      url,
      title,
      company,
      location: location || undefined,
      description,
      // La catégorie Zoho aide le classement par domaine (via les tags).
      tags: category ? [category] : [],
    });
  });

  return jobs;
}

export function makeZohoRecruitScraper(config: ZohoRecruitConfig): Scraper {
  return {
    id: config.id,
    parseList(html: string): RawJob[] {
      return parseZohoRss(html, config.id, config.company);
    },
    async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
      ctx.log(`${config.id} — flux RSS : ${config.rssUrl}`);
      let xml: string;
      try {
        xml = await ctx.fetchHtml(config.rssUrl);
      } catch (err) {
        ctx.log(`${config.id} — échec : ${(err as Error).message}`);
        return [];
      }
      const jobs = parseZohoRss(xml, config.id, config.company);
      ctx.log(`${config.id} — ${jobs.length} poste(s) trouvé(s)`);
      return jobs;
    },
  };
}
