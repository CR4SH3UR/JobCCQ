import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText } from "./util.js";

/**
 * Scraper générique pour un portail de recrutement **UltiPro / UKG**
 * (recruiting.ultipro.ca). Le JobBoard charge ses postes en JS via une API
 * JSON publique : POST `…/JobBoard/<guid>/JobBoardView/LoadSearchResults`.
 * On lit directement cette API (titre, lieu, temps plein, date).
 */
export interface UltiProConfig {
  id: string;
  company: string;
  /** Locataire, ex. « PAT5101PTRK » dans l'URL. */
  tenant: string;
  /** GUID du JobBoard. */
  boardGuid: string;
}

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

interface UltiProOpportunity {
  Id?: string;
  Title?: string;
  FullTime?: boolean;
  JobCategoryName?: string;
  PostedDate?: string;
  Locations?: Array<{
    City?: string;
    State?: { Name?: string; Code?: string };
    Address?: { City?: string; State?: { Name?: string; Code?: string } };
  }>;
}

function cityOf(op: UltiProOpportunity): string | undefined {
  const loc = op.Locations?.[0];
  if (!loc) return undefined;
  const city = loc.City ?? loc.Address?.City;
  const state = loc.State?.Code ?? loc.Address?.State?.Code;
  return [cleanText(city), cleanText(state)].filter(Boolean).join(", ") || undefined;
}

/** Parse la réponse JSON LoadSearchResults en offres brutes. */
export function parseUltiPro(json: string, cfg: UltiProConfig): RawJob[] {
  let data: { opportunities?: UltiProOpportunity[]; Opportunities?: UltiProOpportunity[] };
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  const ops = data.opportunities ?? data.Opportunities ?? [];
  const jobs: RawJob[] = [];
  for (const op of ops) {
    const title = cleanText(op.Title);
    if (!title) continue;
    const url = op.Id
      ? `https://recruiting.ultipro.ca/${cfg.tenant}/JobBoard/${cfg.boardGuid}/OpportunityDetail?opportunityId=${op.Id}`
      : `https://recruiting.ultipro.ca/${cfg.tenant}/JobBoard/${cfg.boardGuid}`;
    jobs.push({
      sourceId: cfg.id,
      url,
      title,
      company: cfg.company,
      location: cityOf(op),
      employmentType: op.FullTime === true ? "temps-plein" : op.FullTime === false ? "temps-partiel" : undefined,
      postedAt: op.PostedDate ? new Date(op.PostedDate).toISOString() : undefined,
      tags: op.JobCategoryName ? [cleanText(op.JobCategoryName)] : [],
    });
  }
  return jobs;
}

async function loadPage(cfg: UltiProConfig, skip: number, top: number): Promise<string> {
  const url = `https://recruiting.ultipro.ca/${cfg.tenant}/JobBoard/${cfg.boardGuid}/JobBoardView/LoadSearchResults`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": BROWSER_UA,
    },
    body: JSON.stringify({
      opportunitySearch: {
        Top: top,
        Skip: skip,
        QueryString: "",
        OrderBy: [{ PropertyName: "PostedDate", Ascending: false }],
        Filters: [],
      },
      matchCriteria: { PreferredJobs: [], Educations: [], LicenseAndCertifications: [], Skills: [] },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export function makeUltiProScraper(config: UltiProConfig): Scraper {
  return {
    id: config.id,
    parseList(json: string): RawJob[] {
      return parseUltiPro(json, config);
    },
    async scrape(params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
      const maxPages = Math.max(1, params.maxPages ?? 3);
      const top = 50;
      const all: RawJob[] = [];
      ctx.log(`${config.id} — API UltiPro : ${config.tenant}/${config.boardGuid}`);
      for (let page = 0; page < maxPages; page++) {
        let json: string;
        try {
          json = await loadPage(config, page * top, top);
        } catch (err) {
          ctx.log(`${config.id} — échec p${page} : ${(err as Error).message}`);
          break;
        }
        const batch = parseUltiPro(json, config);
        all.push(...batch);
        if (batch.length < top) break; // dernière page
      }
      const seen = new Set<string>();
      const jobs = all.filter((j) => (seen.has(j.url) ? false : seen.add(j.url)));
      ctx.log(`${config.id} — ${jobs.length} poste(s) trouvé(s)`);
      return jobs;
    },
  };
}
