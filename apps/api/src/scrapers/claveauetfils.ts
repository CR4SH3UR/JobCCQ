import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * Claveau Et Fils inc. — page WordPress/Divi `/carrieres/`.
 * Aucune fiche de poste : un formulaire Formidable (`#form_carrieres`) avec un
 * menu « Poste désiré ». Chaque option est un métier pour lequel ils recrutent.
 * Pas d'URL propre : ancre `#slug`.
 */
const ID = "claveauetfils-ca";
const COMPANY = "Claveau Et Fils inc.";
const CAREERS_URL = "https://claveauetfils.ca/carrieres/";
const LOCATION = "Jonquière, QC";

const PLACEHOLDER = /^(poste d[ée]sir[ée]|choisir|s[ée]lectionner|--|\s*)$/i;

/** Parseur PUR : options du menu « Poste désiré » → offres. */
export function parseClaveauEtFils(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const base = baseUrl.split("#")[0]!.replace(/\/+$/, "") + "/";
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  const $select = $("#form_carrieres select, form.frm-show-form select").first();
  $select.find("option").each((_, el) => {
    const title = cleanText($(el).attr("value") || $(el).text());
    if (!title || PLACEHOLDER.test(title)) return;
    const url = `${base}#${slugify(title)}`;
    if (seen.has(url)) return;
    seen.add(url);
    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      location: LOCATION,
      tags: [],
    });
  });

  return jobs;
}

export const claveauEtFilsScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseClaveauEtFils(html, baseUrl || CAREERS_URL),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL);
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseClaveauEtFils(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
