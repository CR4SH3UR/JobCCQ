import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText, mapEmploymentType, parseFrenchDate } from "./util.js";

/**
 * Groupe Bellemare — portail Njoyn (bellemare.njoyn.com).
 *
 * La page liste les offres dans un accordéon `#accordion` : un `<h2>` par poste
 * (format « JXXXX-NNNN - Titre du poste ») suivi d'une section `.njnSection` qui
 * contient les métadonnées (catégorie, type, ville, dates) et un lien
 * « Détails du poste » vers la fiche Njoyn. La fiche n'est pas nécessaire pour
 * extraire le titre et les métadonnées principales.
 *
 * On ignore la ligne « Candidature spontanée » qui n'est pas un poste ouvert.
 */
const ID = "groupebellemare-com";
const COMPANY = "Groupe Bellemare";
const CAREERS_URL = "https://bellemare.njoyn.com/cl3/xweb/Xweb.asp?page=joblisting&CLID=53428&lang=2";

const REJECT_TITLES = /candidature\s+spontanée/i;

/** Parse une page de listing Njoyn Bellemare en offres. */
export function parseBellemare(html: string, baseUrl: string): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  const $accordion = $("#accordion");
  if (!$accordion.length) return jobs;

  $accordion.children("h2").each((_, h2) => {
    const $h2 = $(h2);
    const heading = cleanText($h2.text());
    if (!heading || REJECT_TITLES.test(heading)) return;

    // Format habituel : "J0826-0873 - Commis aux services mécaniques"
    const m = heading.match(/^([A-Z]\d{4}-\d{4})\s*[-\u2013\u2014]\s*(.+)$/i);
    const jobId = m?.[1];
    const title = m ? cleanText(m[2]!) : heading;
    if (!title) return;

    const $section = $h2.next(".njnSection");
    if (!$section.length) return;

    const details = new Map<string, string>();
    $section.find(".row").each((_, row) => {
      const $label = $(row).find(".tombstonelabel").first();
      const $value = $(row).find(".tombstonevalue").first();
      const key = cleanText($label.text());
      const value = cleanText($value.text());
      if (key && value) details.set(key, value);
    });

    const detailLink = $section.find('a[href*="JobDetails"]').first().attr("href");
    if (!detailLink) return;

    const url = absolute(baseUrl, detailLink).replace(/&amp;/g, "&");
    if (seen.has(url)) return;
    seen.add(url);

    const location = details.get("Ville");
    const category = details.get("Catégorie");
    const type = details.get("Type de poste");
    const postedAt = parseFrenchDate(details.get("Date d'affichage"));

    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      location: location && location !== "N/A" ? location : undefined,
      employmentType: mapEmploymentType(type),
      postedAt,
      tags: category ? [category] : [],
    });
  });

  return jobs;
}

export const bellemareScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseBellemare(html, baseUrl || CAREERS_URL);
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — listing Njoyn : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL);
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    // Protection Radware : si le captcha est servi, la page n'est pas
    // véritablement accessible. On ne doit pas purger les offres existantes.
    if (/Radware Captcha Page|We apologize for the inconvenience|hcaptcha/i.test(html)) {
      ctx.log(`${ID} — page bloquée par captcha Radware`);
      return [];
    }
    const jobs = parseBellemare(html, CAREERS_URL);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    return jobs;
  },
};
