import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, mapEmploymentType } from "./util.js";

const ID = "atkinsrealis-com";
const COMPANY = "AtkinsRéalis Grands Projets inc.";
const CAREERS_URL =
  "https://careers.atkinsrealis.com/fr-fr/jobs?location=canada+%3E+qu%C3%A9bec&jobarea=construction";
const API_BASE = "https://atkinsats-prod-api.connectid.cloud";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

interface AtkinsRealisApiJob {
  id?: number | string;
  job_requisition_id?: string;
  job_posting_title?: string;
  job_description?: string;
  time_type?: string;
  cities?: string;
  countries?: string;
  regions?: string;
  market_sector?: string;
  job_area?: string;
  sub_job_area?: string;
  discipline?: string;
  external_posting_url?: string;
  salary_min?: number | string | null;
  salary_max?: number | string | null;
  created_at?: string;
  updated_at?: string;
  last_functionally_updated?: string;
  location_mappings?: string[];
}

interface AtkinsRealisApiResponse {
  jobs?: AtkinsRealisApiJob[];
  meta?: {
    totalPages?: number;
    currentPage?: number;
  };
}

function atkinsSlug(text: string): string {
  return cleanText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function jobUrl(job: AtkinsRealisApiJob, title: string): string {
  const req = cleanText(job.job_requisition_id);
  if (!req) return CAREERS_URL;
  return `https://careers.atkinsrealis.com/fr-fr/jobs/${encodeURIComponent(atkinsSlug(title))}-${encodeURIComponent(
    atkinsSlug(req),
  )}`;
}

function firstIso(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (!value) continue;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return undefined;
}

function toNumber(value: number | string | null | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function tagsFor(job: AtkinsRealisApiJob): string[] {
  return [
    cleanText(job.market_sector),
    cleanText(job.job_area),
    cleanText(job.sub_job_area),
    cleanText(job.discipline),
  ].filter((tag, index, tags) => tag && tags.indexOf(tag) === index);
}

export function parseAtkinsRealisJobs(json: string): RawJob[] {
  let data: AtkinsRealisApiResponse;
  try {
    data = JSON.parse(json) as AtkinsRealisApiResponse;
  } catch {
    return [];
  }

  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  for (const item of data.jobs ?? []) {
    const title = cleanText(item.job_posting_title);
    if (!title) continue;

    const url = jobUrl(item, title);
    if (seen.has(url)) continue;
    seen.add(url);

    const salaryMin = toNumber(item.salary_min);
    const salaryMax = toNumber(item.salary_max);
    const location = cleanText(
      Array.isArray(item.location_mappings) && item.location_mappings.length
        ? item.location_mappings.join(" | ")
        : [item.cities, item.regions, item.countries].filter(Boolean).join(", "),
    );

    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      location: location || undefined,
      employmentType: mapEmploymentType(item.time_type),
      salaryMin,
      salaryMax,
      description: cleanText(item.job_description).slice(0, 1200) || undefined,
      postedAt: firstIso(item.created_at, item.last_functionally_updated, item.updated_at),
      tags: tagsFor(item),
    });
  }

  return jobs;
}

async function fetchToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/jobs/token`, {
    headers: {
      "User-Agent": BROWSER_UA,
      Referer: "https://careers.atkinsrealis.com/fr-fr/jobs",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur token AtkinsRéalis`);
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("Jeton AtkinsRéalis manquant");
  return data.token;
}

async function fetchJobsPage(page: number, limit: number, token: string): Promise<string> {
  const body = {
    limit,
    page,
    language: "fr",
    country: "canada > québec",
    job_area: "construction",
  };
  const res = await fetch(`${API_BASE}/api/jobs/jobs`, {
    method: "POST",
    headers: {
      "User-Agent": BROWSER_UA,
      Referer: CAREERS_URL,
      Origin: "https://careers.atkinsrealis.com",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur API emplois AtkinsRéalis`);
  return await res.text();
}

export const atkinsRealisScraper: Scraper = {
  id: ID,
  parseList(html: string): RawJob[] {
    return parseAtkinsRealisJobs(html);
  },
  async scrape(params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    const limit = 50;
    const maxPages = Math.max(1, params.maxPages ?? 3);
    const all = new Map<string, RawJob>();

    ctx.log(`${ID} — API AtkinsRéalis : Québec > Construction`);
    let token: string;
    try {
      token = await fetchToken();
    } catch (err) {
      ctx.log(`${ID} — échec jeton : ${(err as Error).message}`);
      return [];
    }

    for (let page = 1; page <= maxPages; page++) {
      let json: string;
      try {
        json = await fetchJobsPage(page, limit, token);
      } catch (err) {
        ctx.log(`${ID} — arrêt page ${page} : ${(err as Error).message}`);
        break;
      }

      const data = JSON.parse(json) as AtkinsRealisApiResponse;
      for (const job of parseAtkinsRealisJobs(json)) all.set(job.url, job);
      const totalPages = data.meta?.totalPages ?? page;
      if (page >= totalPages) break;
    }

    const jobs = [...all.values()];
    if (jobs.length === 0) ctx.markNoOpenings?.(false);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    return jobs;
  },
};
