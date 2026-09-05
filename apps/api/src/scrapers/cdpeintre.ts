import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * CD Peintre (cdpeintre.com) — entrepreneur peintre, Gatineau (Outaouais).
 *
 * La page carrière (`/carriere.php`) présente chaque poste comme un titre `<h2>`
 * suivi, dans la même carte, d'un bouton « Postulez en ligne » qui pointe tous
 * vers la même ancre de formulaire (`carriere.php#row_SECTION_…`). Il n'y a donc
 * pas d'URL propre par poste : on repère chaque bouton de candidature et on
 * rattache le titre au dernier intitulé rencontré avant lui, puis on fabrique
 * une URL stable par ancre slugifiée.
 */
const ID = "cdpeintre-com";
const COMPANY = "CD Peintre";
const CAREERS_URL = "https://www.cdpeintre.com/carriere.php";

/** Intitulés de section (non-postes) à ignorer si jamais ils précèdent un bouton. */
const NON_JOB = /^(carri[eè]re|pourquoi|nous offrons|infos|pr[ée]f[ée]rences|langue|r[ée]glages|coordonn[ée]es|suivez)/i;

function isJobTitle(t: string): boolean {
  if (!t || t.length < 3 || t.length > 120) return false;
  if (t.endsWith("?")) return false;
  return !NON_JOB.test(t);
}

/** Parse la page carrière et retourne une offre par bouton « Postulez ». */
export function parseCdPeintre(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  const base = baseUrl.split("#")[0]!;

  // Parcours en ordre du document : on retient le dernier intitulé vu, et chaque
  // bouton de candidature « valide » ce dernier intitulé comme titre de poste.
  let lastHeading = "";
  $("h1, h2, h3, h4, a").each((_, el) => {
    const tag = (el.tagName || "").toLowerCase();
    if (/^h[1-4]$/.test(tag)) {
      lastHeading = cleanText($(el).text());
      return;
    }
    // <a> : bouton de candidature ?
    const href = ($(el).attr("href") ?? "").trim();
    const label = cleanText($(el).text());
    const isApply = /carriere\.php#/i.test(href) || /postul/i.test(label);
    if (!isApply) return;
    if (!isJobTitle(lastHeading)) return;

    const url = `${base}#${slugify(lastHeading)}`;
    if (seen.has(url)) return;
    seen.add(url);
    jobs.push({ sourceId: ID, url, title: lastHeading, company: COMPANY, tags: [] });
  });

  return jobs;
}

export const cdPeintreScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseCdPeintre(html, baseUrl || CAREERS_URL),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrière : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL);
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseCdPeintre(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
