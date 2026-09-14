import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText, mapEmploymentType } from "./util.js";

/**
 * A.G.M. Construction — page Webflow `/careers`.
 * Les postes sont des items CMS (`.job-list-item`) : titre + lien `/carriere/<slug>`,
 * lieu et type dans `.job-basis`. Pas de JSON-LD JobPosting ni de fiche Jobillico.
 */
const ID = "agmconstruction-ca";
const COMPANY = "A.G.M. Construction Inc.";
const CAREERS_URL = "https://www.agmconstruction.ca/careers";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Parseur PUR : cartes Webflow « postes disponibles » → offres. */
export function parseAgmConstruction(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $(".job-list-item, .w-dyn-item").each((_, el) => {
    const $item = $(el);
    const $a = $item.find("a.job-link, a[href*='/carriere/']").first();
    const href = ($a.attr("href") ?? "").trim();
    const title = cleanText($a.text());
    if (!title || !href || href === "/careers" || href === "/carriere") return;

    const url = absolute(baseUrl, href).split("#")[0]!.split("?")[0]!;
    if (!/\/carriere\/[^/]+/i.test(url) || seen.has(url)) return;
    seen.add(url);

    const bits = $item
      .find(".job-basis > div")
      .map((_, d) => cleanText($(d).text()))
      .get()
      .filter((t) => t && t !== ",");
    const location = bits.find((t) => !/temps\s+(plein|partiel)|stage|contrat/i.test(t));
    const typeText = bits.find((t) => /temps\s+(plein|partiel)|stage|contrat/i.test(t));

    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      location: location || undefined,
      employmentType: mapEmploymentType(typeText),
      tags: [],
    });
  });

  return jobs;
}

export const agmConstructionScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseAgmConstruction(html, baseUrl || CAREERS_URL),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL, { userAgent: BROWSER_UA });
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseAgmConstruction(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
