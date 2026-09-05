import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText, mapEmploymentType } from "./util.js";

/**
 * Excavation Bertrand Ostiguy (bertrandostiguy.ca) — excavation, génie civil,
 * égouts/aqueducs en Montérégie/Estrie.
 *
 * La page /emplois/ liste les postes dans un accordéon LM Carrières :
 *  - navigation `.jobs-list` avec des ancres `#job-<id>` et `.job-name`
 *  - contenu `.jobs-content` avec l'URL réelle de postulation dans
 *    `.copy_job_url` (ou un lien `/postuler-emploi/<slug>/`) et le type de
 *    poste dans `<p><strong>POSTE</strong>: ...</p>`.
 */
const ID = "bertrandostiguy-ca";
const COMPANY = "Bertrand Ostiguy Inc.";
const CAREERS_URL = "https://bertrandostiguy.ca/emplois/";

/** Parse une page d'emplois Bertrand Ostiguy en offres. */
export function parseBertrandOstiguy(html: string, baseUrl: string): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $("#lmc-jobs .jobs-list a[href^='#job-']").each((_, a) => {
    const $a = $(a);
    const anchor = $a.attr("href");
    if (!anchor) return;
    const jobId = anchor.replace(/^#/, "");

    const title = cleanText($a.find(".job-name").text() || $a.text());
    if (!title) return;

    const $content = $(".jobs-content").find(`#${jobId}`).first();
    if (!$content.length) return;

    let url =
      $content.find("a.copy_job_url").attr("href") ||
      $content.find('a[href*="/postuler-emploi/"]').first().attr("href") ||
      "";
    if (!url) return;
    url = absolute(baseUrl, url).replace(/&amp;/g, "&");

    if (seen.has(url)) return;
    seen.add(url);

    const typeText = $content
      .find("p")
      .filter((_, p) => /POSTE\s*:/i.test($(p).text()))
      .first()
      .text();
    const typeMatch = typeText.match(/POSTE\s*:\s*(.+)/i);
    const employmentType = mapEmploymentType(typeMatch?.[1]);

    jobs.push({ sourceId: ID, url, title, company: COMPANY, employmentType, tags: [] });
  });

  return jobs;
}

export const bertrandOstiguyScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseBertrandOstiguy(html, baseUrl || CAREERS_URL);
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
    const jobs = parseBertrandOstiguy(html, CAREERS_URL);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    return jobs;
  },
};
