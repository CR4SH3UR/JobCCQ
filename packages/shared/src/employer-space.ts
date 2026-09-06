/**
 * Comptes employeurs (idées 87–89) : réclamation, offre publiée, stats.
 * Parsers purs — aucun réseau.
 */
import { hashText } from "./jobs-shards.js";
import type { Job } from "./types.js";

export const CLAIM_STATUSES = ["pending", "approved", "rejected"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const EMPLOYER_JOB_STATUSES = ["pending", "approved", "rejected"] as const;
export type EmployerJobStatus = (typeof EMPLOYER_JOB_STATUSES)[number];

export type EmployerPatch = {
  description?: string;
  logoUrl?: string;
};

export type EmployerJobDraft = {
  title: string;
  url?: string;
  location?: string;
  city?: string;
  regionId?: string;
  categoryId?: string;
  employmentType?: Job["employmentType"];
  remote?: Job["remote"];
  salaryMin?: number;
  salaryMax?: number;
  salaryPeriod?: Job["salaryPeriod"];
  description?: string;
};

export function parseClaimStatus(raw: unknown): ClaimStatus | undefined {
  return CLAIM_STATUSES.includes(raw as ClaimStatus) ? (raw as ClaimStatus) : undefined;
}

export function parseEmployerJobStatus(raw: unknown): EmployerJobStatus | undefined {
  return EMPLOYER_JOB_STATUSES.includes(raw as EmployerJobStatus)
    ? (raw as EmployerJobStatus)
    : undefined;
}

export function parseEmployerPatch(raw: unknown): EmployerPatch {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const description = typeof o.description === "string" ? o.description.trim() : "";
  const logoUrl = typeof o.logoUrl === "string" ? o.logoUrl.trim() : "";
  return {
    ...(description ? { description: description.slice(0, 2_000) } : {}),
    ...(logoUrl && /^https?:\/\//i.test(logoUrl) ? { logoUrl } : {}),
  };
}

export function employerJobId(employerId: string, title: string, createdAt: string): string {
  return `e-${hashText(`${employerId}\0${title.trim().toLowerCase()}\0${createdAt}`)}`;
}

export function isEmployerPostedJobId(id: string): boolean {
  return id.startsWith("e-");
}

/** Lien fiche : les offres employeur n'ont pas de page SSG. */
export function jobDetailHref(id: string): string {
  return isEmployerPostedJobId(id) ? `/emplois/e/?id=${encodeURIComponent(id)}` : `/emplois/${id}/`;
}

export function validateEmployerJobDraft(raw: EmployerJobDraft): {
  ok: boolean;
  errors: string[];
  value?: EmployerJobDraft;
} {
  const errors: string[] = [];
  const title = (raw.title ?? "").trim();
  if (title.length < 4) errors.push("Le titre est trop court.");
  if (title.length > 160) errors.push("Le titre est trop long.");
  const url = (raw.url ?? "").trim();
  if (url && !/^https?:\/\//i.test(url)) errors.push("L'URL de candidature doit commencer par https://.");
  const salaryMin = raw.salaryMin != null && Number.isFinite(raw.salaryMin) ? raw.salaryMin : undefined;
  const salaryMax = raw.salaryMax != null && Number.isFinite(raw.salaryMax) ? raw.salaryMax : undefined;
  if (salaryMin != null && salaryMin < 0) errors.push("Salaire min invalide.");
  if (salaryMax != null && salaryMax < 0) errors.push("Salaire max invalide.");
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    value: {
      title,
      url: url || undefined,
      location: raw.location?.trim() || undefined,
      city: raw.city?.trim() || undefined,
      regionId: raw.regionId?.trim() || undefined,
      categoryId: raw.categoryId?.trim() || undefined,
      employmentType: raw.employmentType,
      remote: raw.remote,
      salaryMin,
      salaryMax,
      salaryPeriod: raw.salaryPeriod,
      description: raw.description?.trim().slice(0, 4_000) || undefined,
    },
  };
}

export function draftToJob(
  draft: EmployerJobDraft,
  employer: { id: string; name: string },
  createdAt: string,
): Job {
  const id = employerJobId(employer.id, draft.title, createdAt);
  const applyUrl = draft.url || `https://jobccqc.ca/emplois/e/?id=${id}`;
  return {
    id,
    sourceId: employer.id,
    url: applyUrl,
    title: draft.title,
    company: employer.name,
    location: draft.location,
    city: draft.city,
    regionId: draft.regionId,
    categoryId: draft.categoryId,
    employmentType: draft.employmentType,
    remote: draft.remote,
    salaryMin: draft.salaryMin,
    salaryMax: draft.salaryMax,
    salaryPeriod: draft.salaryPeriod,
    currency: "CAD",
    description: draft.description,
    tags: ["employeur"],
    languages: [],
    postedAt: createdAt,
    scrapedAt: createdAt,
  };
}

export function filterByEmployers<T extends { sourceId: string }>(
  items: T[],
  employerIds: readonly string[],
): T[] {
  const set = new Set(employerIds);
  return items.filter((i) => set.has(i.sourceId));
}

export function labelForClaimStatus(s: ClaimStatus): string {
  return s === "approved" ? "Approuvée" : s === "rejected" ? "Refusée" : "En attente";
}

export function labelForEmployerJobStatus(s: EmployerJobStatus): string {
  return s === "approved" ? "Publiée" : s === "rejected" ? "Refusée" : "En modération";
}
