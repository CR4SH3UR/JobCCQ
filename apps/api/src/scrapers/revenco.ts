import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, mapEmploymentType } from "./util.js";

/**
 * Revenco inc. (revenco.ca) — entrepreneur électricien.
 *
 * La page carrières n'expose qu'**un seul** JSON-LD `JobPosting` — et c'est une
 * fiche « marketing » de la page elle-même (« Carrières Avec Les Spécialistes En
 * électricité ⚡ Revenco »), pas une vraie offre. La méthode `jsonld` ne
 * ramenait donc qu'une entrée parasite, tandis que le repli HTML récupérait les
 * 11 liens mais avec le libellé du bouton (« Lire les détails ») comme titre.
 *
 * Les vraies offres sont des cartes structurées dans la section `#emplois` :
 *   <div class="row emploi">
 *     <div><h3>Chargé de projets électrique</h3></div>
 *     <div><p>Temps plein</p><p>3 ans d'expérience</p></div>
 *     <a href="/emplois/<slug>/" class="cta-horizontal">Lire les détails</a>
 *   </div>
 * Ce parseur sur mesure lit le titre (`h3`), le type (`Temps plein`…) et l'URL
 * de chaque carte.
 */
const ID = "revenco-ca";
const COMPANY = "Revenco inc.";
const CAREERS_URL = "https://revenco.ca/carrieres-domaine-electricite/";

/** Parse les cartes d'offres de la section `#emplois`. */
export function parseRevenco(html: string): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $("#emplois .row.emploi").each((_, el) => {
    const $c = $(el);
    const href = $c.find('a[href*="/emplois/"]').first().attr("href");
    const title = cleanText($c.find("h3").first().text());
    if (!href || !title) return;
    const url = href.split("#")[0]!.split("?")[0]!;
    if (!/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.add(url);

    // 1er <p> = type de poste (« Temps plein »), 2e = expérience → étiquette.
    const ps = $c
      .find("p")
      .map((_i, p) => cleanText($(p).text()))
      .get()
      .filter(Boolean);

    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      employmentType: mapEmploymentType(ps[0]),
      tags: ps.slice(1).filter((t) => /exp[ée]rience|ccq|ans\b/i.test(t)),
    });
  });

  return jobs;
}

export const revencoScraper: Scraper = {
  id: ID,
  parseList(html: string): RawJob[] {
    return parseRevenco(html);
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL);
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseRevenco(html);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    return jobs;
  },
};
