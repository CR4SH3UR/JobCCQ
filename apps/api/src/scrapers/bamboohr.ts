import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, mapEmploymentType } from "./util.js";

/**
 * Scraper générique pour un portail carrières **BambooHR** (ATS).
 *
 * La page carrières de l'employeur charge ses postes en AJAX depuis BambooHR,
 * qui expose un flux JSON public : `https://<sous-domaine>.bamboohr.com/careers/list`.
 * On lit ce flux (titre, lieu, département, statut d'emploi).
 */
export interface BambooHrConfig {
  id: string;
  company: string;
  /** Sous-domaine BambooHR, ex. « atwillmorin » pour atwillmorin.bamboohr.com. */
  subdomain: string;
}

interface BambooOpening {
  id?: string | number;
  jobOpeningName?: string;
  departmentLabel?: string;
  employmentStatusLabel?: string;
  location?: { city?: string; state?: string };
  isRemote?: boolean | null;
}

/** Parse le JSON `careers/list` de BambooHR en offres brutes. */
export function parseBambooHrList(
  json: string,
  id: string,
  company: string,
  base: string,
): RawJob[] {
  let data: { result?: BambooOpening[] };
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  const result = Array.isArray(data?.result) ? data.result : [];
  const jobs: RawJob[] = [];

  for (const r of result) {
    const title = cleanText(r?.jobOpeningName);
    const jobId = r?.id != null ? String(r.id) : "";
    if (!title || !jobId) continue;

    const city = cleanText(r?.location?.city);
    const state = cleanText(r?.location?.state);
    const location = [city, state].filter(Boolean).join(", ") || undefined;
    const dept = cleanText(r?.departmentLabel);

    jobs.push({
      sourceId: id,
      url: `${base}/careers/${jobId}`,
      title,
      company,
      location,
      remote: r?.isRemote ? "teletravail" : undefined,
      employmentType: mapEmploymentType(r?.employmentStatusLabel),
      // Le département BambooHR aide le classement par domaine (via les tags).
      tags: dept ? [dept] : [],
    });
  }

  return jobs;
}

export function makeBambooHrScraper(config: BambooHrConfig): Scraper {
  const base = `https://${config.subdomain}.bamboohr.com`;
  return {
    id: config.id,
    parseList(json: string): RawJob[] {
      return parseBambooHrList(json, config.id, config.company, base);
    },
    async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
      const url = `${base}/careers/list`;
      ctx.log(`${config.id} — flux BambooHR : ${url}`);
      let json: string;
      try {
        json = await ctx.fetchHtml(url);
      } catch (err) {
        ctx.log(`${config.id} — échec : ${(err as Error).message}`);
        return [];
      }
      const jobs = parseBambooHrList(json, config.id, config.company, base);
      ctx.log(`${config.id} — ${jobs.length} poste(s) trouvé(s)`);
      return jobs;
    },
  };
}
