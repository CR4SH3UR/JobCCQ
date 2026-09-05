import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * Can-Inspec inc. (can-inspec.ca) — spécialiste en inspection télévisée de
 * canalisations souterraines.
 *
 * La page unique https://can-inspec.ca/#emplois présente les postes dans une
 * section « Postes offerts ». Chaque poste est un titre h3 suivi d'un court
 * paragraphe descriptif. Il n'y a pas de fiche distincte, donc on génère une
 * URL par poste avec un fragment basé sur le titre slugifié.
 */
const ID = "can-inspec-ca";
const COMPANY = "Can-Inspec inc.";
const CAREERS_URL = "https://can-inspec.ca/#emplois";

/** Parse la page carrières de Can-Inspec et retourne une offre par titre h3. */
export function parseCanInspec(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  // Repère le titre de section « Postes offerts » (généralement un h2).
  const offeredHeading = $("h2, h3")
    .filter((_, el) => cleanText($(el).text()).toLowerCase() === "postes offerts")
    .first();
  if (!offeredHeading.length) return jobs;

  // Tous les h3 situés dans le même conteneur parent que le titre de section.
  offeredHeading
    .parent()
    .find("h3")
    .each((_, h3) => {
      const title = cleanText($(h3).text());
      if (!title || title.length < 3) return;

      const fragment = slugify(title);
      const url = `${baseUrl.split("#")[0]}#${fragment}`;
      if (seen.has(url)) return;
      seen.add(url);

      const description = cleanText($(h3).next("p").text()) || undefined;

      jobs.push({
        sourceId: ID,
        url,
        title,
        company: COMPANY,
        description,
        tags: [],
      });
    });

  return jobs;
}

export const canInspecScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseCanInspec(html, baseUrl || CAREERS_URL);
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL);
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseCanInspec(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
