import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, mapEmploymentType, mapSalaryUnit, parseFrenchDate } from "./util.js";

const BASE = "https://www.espresso-jobs.com";
const SOURCE_ID = "espresso-jobs";

function toNumber(v?: string): number | undefined {
  if (!v) return undefined;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function remoteFromText(text: string): RawJob["remote"] {
  const t = text.toLowerCase();
  if (/hybride/.test(t)) return "hybride";
  if (/télétravail|teletravail|à distance|a distance|remote/.test(t)) return "teletravail";
  if (/présentiel|presentiel|sur place/.test(t)) return "presentiel";
  return undefined;
}

/**
 * Parse la liste d'offres d'Espresso-Jobs. Chaque carte
 * `div.job_index-content_list_item` expose des attributs `data-*` riches
 * (id, ville/province, salaire), plus un lien « Postulez ici » vers l'offre.
 */
export function parseList(html: string): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];

  $("div.job_index-content_list_item").each((_, el) => {
    const $card = $(el);
    const id = cleanText($card.attr("id"));
    if (!id) return;

    const title =
      cleanText($card.find(".job_index-content_list_item-title").attr("title")) ||
      cleanText($card.find(".job_index-content_list_item-title").text());
    const company = cleanText($card.find(".job_index-content_list_item-company").first().text());
    if (!title || !company) return;

    const applyHref = $card.find('a[href*="/emploi/appliquer"]').attr("href");
    const url = applyHref
      ? new URL(applyHref, BASE).toString()
      : `${BASE}/emploi/appliquer?id=${id}`;

    const $loc = $card.find(".job-location-info").first();
    const city = cleanText($loc.attr("data-city"));
    const province = cleanText($loc.attr("data-province"));
    const locText = cleanText($loc.text());
    const location = [city, province].filter(Boolean).join(", ") || locText || undefined;

    const $sal = $card.find(".job_index-content_list_item_infos-salary").first();
    const salaryMin = toNumber($sal.attr("data-salary-min"));
    const salaryMax = toNumber($sal.attr("data-salary-max"));
    const salaryPeriod = mapSalaryUnit($sal.attr("data-salary-unit"));

    const typeText = cleanText($card.find(".job_index-content_list_item_infos-type").text());
    const publishText = cleanText($card.find(".publish-time").first().text());

    const companyLogo = $card.find(".job_index-content_list_item-logo img").attr("data-src");

    jobs.push({
      sourceId: SOURCE_ID,
      url,
      title,
      company,
      companyLogoUrl: companyLogo && /^https?:\/\//.test(companyLogo) ? companyLogo : undefined,
      location,
      remote: remoteFromText(`${locText} ${typeText}`),
      employmentType: mapEmploymentType(typeText),
      salaryMin,
      salaryMax,
      salaryPeriod,
      postedAt: parseFrenchDate(publishText),
      tags: [],
    });
  });

  return jobs;
}

export const espressoJobsScraper: Scraper = {
  id: SOURCE_ID,
  parseList,
  async scrape(params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    // Espresso-Jobs rend la liste côté serveur pour la première page seulement
    // (pagination et recherche pilotées en JS). On récupère donc la liste
    // publiée sur /emploi.
    const kw = params.query ? `?q=${encodeURIComponent(params.query)}` : "";
    const url = `${BASE}/emploi${kw}`;
    ctx.log(`Espresso-Jobs — liste : ${url}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(url);
    } catch (err) {
      ctx.log(`Espresso-Jobs — échec : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseList(html);
    ctx.log(`Espresso-Jobs — ${jobs.length} offres`);
    return jobs;
  },
};
