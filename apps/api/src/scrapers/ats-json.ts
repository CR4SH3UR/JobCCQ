import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, mapEmploymentType } from "./util.js";

/**
 * Scrapers génériques pour les ATS exposant une **API JSON publique**.
 * Chaque plateforme est identifiée par un `handle` (jeton/sous-domaine détecté
 * lors de la découverte RBQ) et lue via son endpoint documenté — aucune page
 * JS à rendre, on lit directement le JSON des postes.
 *
 *  · Greenhouse     : boards-api.greenhouse.io/v1/boards/<handle>/jobs
 *  · Lever          : api.lever.co/v0/postings/<handle>?mode=json
 *  · Recruitee      : <handle>.recruitee.com/api/offers/
 *  · SmartRecruiters: api.smartrecruiters.com/v1/companies/<handle>/postings
 */
export type AtsPlatform = "greenhouse" | "lever" | "recruitee" | "smartrecruiters";

export interface AtsJsonConfig {
  id: string;
  company: string;
  platform: AtsPlatform;
  /** Jeton/sous-domaine de l'employeur sur la plateforme. */
  handle: string;
}

const endpoint = (platform: AtsPlatform, handle: string): string => {
  switch (platform) {
    case "greenhouse":
      return `https://boards-api.greenhouse.io/v1/boards/${handle}/jobs`;
    case "lever":
      return `https://api.lever.co/v0/postings/${handle}?mode=json`;
    case "recruitee":
      return `https://${handle}.recruitee.com/api/offers/`;
    case "smartrecruiters":
      return `https://api.smartrecruiters.com/v1/companies/${handle}/postings`;
  }
};

/** Parse la réponse JSON d'un ATS en offres brutes (fonction pure). */
export function parseAtsJson(
  json: string,
  platform: AtsPlatform,
  id: string,
  company: string,
  handle: string,
): RawJob[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  const jobs: RawJob[] = [];
  const push = (title?: string, url?: string, location?: string, type?: string) => {
    const t = cleanText(title);
    if (!t || !url) return;
    jobs.push({
      sourceId: id,
      url,
      title: t,
      company,
      location: cleanText(location) || undefined,
      employmentType: mapEmploymentType(type),
    });
  };

  if (platform === "greenhouse") {
    const arr = (data as { jobs?: unknown[] })?.jobs ?? [];
    for (const j of arr as Array<{ title?: string; absolute_url?: string; location?: { name?: string } }>) {
      push(j?.title, j?.absolute_url, j?.location?.name);
    }
  } else if (platform === "lever") {
    for (const j of (Array.isArray(data) ? data : []) as Array<{
      text?: string;
      hostedUrl?: string;
      categories?: { location?: string; commitment?: string };
    }>) {
      push(j?.text, j?.hostedUrl, j?.categories?.location, j?.categories?.commitment);
    }
  } else if (platform === "recruitee") {
    const arr = (data as { offers?: unknown[] })?.offers ?? [];
    for (const j of arr as Array<{
      title?: string;
      careers_url?: string;
      location?: string;
      city?: string;
      employment_type_code?: string;
    }>) {
      push(j?.title, j?.careers_url, j?.location || j?.city, j?.employment_type_code);
    }
  } else if (platform === "smartrecruiters") {
    const arr = (data as { content?: unknown[] })?.content ?? [];
    for (const j of arr as Array<{
      name?: string;
      id?: string;
      location?: { city?: string; region?: string };
      typeOfEmployment?: { label?: string };
    }>) {
      const city = [j?.location?.city, j?.location?.region].filter(Boolean).join(", ");
      const url = j?.id ? `https://jobs.smartrecruiters.com/${handle}/${j.id}` : undefined;
      push(j?.name, url, city, j?.typeOfEmployment?.label);
    }
  }

  return jobs;
}

export function makeAtsJsonScraper(config: AtsJsonConfig): Scraper {
  const url = endpoint(config.platform, config.handle);
  return {
    id: config.id,
    parseList(json: string): RawJob[] {
      return parseAtsJson(json, config.platform, config.id, config.company, config.handle);
    },
    async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
      ctx.log(`${config.id} — API ${config.platform} : ${url}`);
      let json: string;
      try {
        json = await ctx.fetchHtml(url);
      } catch (err) {
        ctx.log(`${config.id} — échec : ${(err as Error).message}`);
        return [];
      }
      const jobs = parseAtsJson(json, config.platform, config.id, config.company, config.handle);
      ctx.log(`${config.id} — ${jobs.length} poste(s) trouvé(s)`);
      return jobs;
    },
  };
}
