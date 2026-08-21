import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { htmlToText } from "./jsonld.js";
import { cleanText, mapEmploymentType, slugify } from "./util.js";

/**
 * Scraper générique pour un portail carrières **Zoho Recruit**.
 *
 * La page `…/jobs/<Page>` est une application JS. Deux voies d'accès aux offres :
 *  1. le **flux RSS** `…/jobs/<Page>/rss` (titre, lien, lieu, catégorie) ;
 *  2. si le flux est désactivé, le **JSON embarqué** dans la page carrières
 *     (`input#jobs`), qui contient tous les champs de chaque poste.
 */
export interface ZohoRecruitConfig {
  id: string;
  company: string;
  /** URL de la page carrières, ex. https://x.zohorecruit.com/jobs/Careers */
  careersUrl: string;
  /**
   * Ne conserver que les postes dont l'intitulé correspond (ex. `/\(GLR\)/i`).
   * Sert quand plusieurs entités **partagent un même portail Zoho** (ex. GLR
   * utilise celui d'EBC) : on ne garde que les postes étiquetés pour l'entité.
   */
  titleFilter?: RegExp;
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
    if (/candidature spontan|spontaneous application|application spontan/i.test(title)) return;

    const rawDesc = $it.find("description").first().text();
    const location = cleanText(
      (rawDesc.match(/Lieu\s*:\s*(.*?)\s*<br/i)?.[1] ?? "").replace(/<[^>]+>/g, ""),
    );
    const category = cleanText(rawDesc.match(/Cat[ée]gorie\s*:\s*(.*?)\s*<br/i)?.[1] ?? "");

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
      tags: category ? [category] : [],
    });
  });

  return jobs;
}

/**
 * Repli : la page carrières embarque la liste des postes en JSON dans un champ
 * caché (`input#jobs`, sinon tout input dont la valeur est un tableau JSON
 * contenant `Posting_Title`). Utilisé quand le flux RSS est désactivé.
 */
export function parseZohoCareersJson(
  html: string,
  id: string,
  company: string,
  careersUrl: string,
): RawJob[] {
  const $ = cheerio.load(html);
  let raw = $("input#jobs").attr("value");
  if (!raw) {
    $("input[value]").each((_, el) => {
      if (raw) return;
      const v = $(el).attr("value");
      if (v && v.trimStart().startsWith("[") && v.includes("Posting_Title")) raw = v;
    });
  }
  if (!raw) return [];

  let records: Array<Record<string, unknown>>;
  try {
    const parsed = JSON.parse(raw);
    records = Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }

  const base = careersUrl.replace(/\/+$/, "");

  const jobs: RawJob[] = [];
  for (const r of records) {
    const title = cleanText(String(r.Posting_Title ?? ""));
    const jobId = cleanText(String(r.id ?? ""));
    if (!title || !jobId) continue;
    // « Candidature spontanée » = entrée « postulez même sans poste ouvert »,
    // pas une vraie offre. Fréquent sur les portails Zoho.
    if (/candidature spontan|spontaneous application|application spontan/i.test(title)) continue;

    const location =
      [r.City, r.State].map((v) => cleanText(String(v ?? ""))).filter(Boolean).join(", ") ||
      undefined;
    const industry = cleanText(String(r.Industry ?? ""));
    const date = cleanText(String(r.Date_Opened ?? ""));

    jobs.push({
      sourceId: id,
      url: `${base}/${jobId}/${slugify(title)}`,
      title,
      company,
      location,
      remote: r.Remote_Job === true ? "teletravail" : undefined,
      employmentType: mapEmploymentType(String(r.Job_Type ?? "")),
      description: htmlToText(String(r.Job_Description ?? "")),
      postedAt: date || undefined,
      tags: industry ? [industry] : [],
    });
  }
  return jobs;
}

export function makeZohoRecruitScraper(config: ZohoRecruitConfig): Scraper {
  const base = config.careersUrl.replace(/\/+$/, "");
  const rssUrl = `${base}/rss`;
  const keep = (jobs: RawJob[]): RawJob[] =>
    config.titleFilter ? jobs.filter((j) => config.titleFilter!.test(j.title)) : jobs;
  return {
    id: config.id,
    parseList(html: string): RawJob[] {
      // RSS (XML) si c'est un flux, sinon JSON embarqué de la page carrières.
      if (html.trimStart().startsWith("<?xml") || html.includes("<item>")) {
        return keep(parseZohoRss(html, config.id, config.company));
      }
      return keep(parseZohoCareersJson(html, config.id, config.company, config.careersUrl));
    },
    async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
      // 1) Flux RSS (le plus propre).
      try {
        const xml = await ctx.fetchHtml(rssUrl);
        const rss = keep(parseZohoRss(xml, config.id, config.company));
        if (rss.length > 0) {
          ctx.log(`${config.id} — ${rss.length} poste(s) via RSS`);
          return rss;
        }
        ctx.log(`${config.id} — RSS vide/désactivé, repli sur le JSON de la page carrières`);
      } catch (err) {
        ctx.log(`${config.id} — RSS indisponible (${(err as Error).message}), repli JSON`);
      }
      // 2) JSON embarqué de la page carrières.
      try {
        const html = await ctx.fetchHtml(config.careersUrl);
        const jobs = keep(parseZohoCareersJson(html, config.id, config.company, config.careersUrl));
        ctx.log(`${config.id} — ${jobs.length} poste(s) via JSON embarqué`);
        return jobs;
      } catch (err) {
        ctx.log(`${config.id} — échec : ${(err as Error).message}`);
        return [];
      }
    },
  };
}
