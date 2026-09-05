import type { Job } from "./types.js";

export interface JobCompleteness {
  readonly score: number;
  readonly max: 5;
  readonly missing: string[];
}

/**
 * Score de complétude d'une fiche (salaire, lieu, description, type, date).
 * Aide à repérer les offres trop maigres côté site et admin.
 */
export function jobCompleteness(job: Job): JobCompleteness {
  const checks: { ok: boolean; label: string }[] = [
    { ok: job.salaryMin != null || job.salaryMax != null, label: "salaire" },
    { ok: !!(job.city || job.location || job.regionId), label: "lieu" },
    { ok: !!(job.description && job.description.length >= 80), label: "description" },
    { ok: !!job.employmentType, label: "type de poste" },
    { ok: !!job.postedAt, label: "date de publication" },
  ];
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  return { score: checks.length - missing.length, max: 5, missing };
}
