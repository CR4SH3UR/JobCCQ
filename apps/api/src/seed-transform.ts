import type { Job } from "@jobccq/shared";
import { normalizeRawJob } from "./normalize.js";
import type { SeedJob } from "./seed-data.js";

export function postedAtFrom(daysAgo?: number): string | undefined {
  if (daysAgo == null) return undefined;
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
}

/** Convertit une offre de démo en offre normalisée (les champs explicites priment). */
export function seedToJob(s: SeedJob): Job {
  const base = normalizeRawJob({
    sourceId: s.sourceId,
    url: s.url,
    title: s.title,
    company: s.company,
    location: s.location,
    remote: s.remote,
    employmentType: s.employmentType,
    salaryMin: s.salaryMin,
    salaryMax: s.salaryMax,
    salaryPeriod: s.salaryPeriod,
    description: s.description,
    tags: s.tags,
    postedAt: postedAtFrom(s.postedDaysAgo),
  });

  return {
    ...base,
    regionId: s.regionId ?? base.regionId,
    city: s.city ?? base.city,
    categoryId: s.categoryId ?? base.categoryId,
    remote: s.remote ?? base.remote,
    languages: s.languages ?? base.languages,
  };
}
