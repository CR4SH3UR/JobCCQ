import type {
  FacetCount,
  HiringCompany,
  Job,
  JobFacets,
  JobQuery,
  JobSearchResult,
  SortOption,
} from "./types.js";
import {
  JOB_CATEGORIES,
  EMPLOYMENT_TYPES,
  LANGUAGES,
  QUEBEC_REGIONS,
  REMOTE_TYPES,
  labelForCategory,
  labelForEmployment,
  labelForLanguage,
  labelForRegion,
  labelForRemote,
} from "./taxonomy.js";
import { sourceName } from "./sources.js";
import { isCcqTrade, ccqTradeOf } from "./ccq.js";
import { normalizeText, fuzzyIncludes } from "./text.js";
import { expandTerm } from "./synonyms.js";
import { detectShift } from "./extract.js";
import { annualizedSalary } from "./salary.js";
import { collapseDuplicates } from "./duplicates.js";

const norm = normalizeText;

function daysSince(iso?: string): number | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  return (Date.now() - t) / 86_400_000;
}

/**
 * Un mot de la requête correspond-il à l'offre ?
 *  1. Sous-chaîne directe **ou synonyme de métier** sur tout le texte (titre,
 *     entreprise, description, tags) — ex. « charpentier » ↔ « menuisier ».
 *  2. Sinon, tolérance aux fautes de frappe sur les champs courts (titre +
 *     entreprise + tags) — ex. « charpentié » → « charpentier ». On limite le
 *     flou aux champs courts pour rester rapide et précis (pas la description).
 */
function wordMatches(word: string, fullText: string, shortText: string): boolean {
  if (!word) return true;
  for (const term of expandTerm(word)) {
    if (fullText.includes(term)) return true;
  }
  return fuzzyIncludes(shortText, word);
}

/** Un texte de recherche correspond-il à l'offre ? (titre, entreprise, desc, tags) */
function matchesText(job: Job, q: string): boolean {
  const needle = norm(q);
  if (!needle) return true;
  const fullText = norm(
    [job.title, job.company, job.description ?? "", (job.tags ?? []).join(" ")].join(" "),
  );
  const shortText = norm([job.title, job.company, (job.tags ?? []).join(" ")].join(" "));
  // Chaque mot de la requête doit correspondre (ET logique).
  return needle.split(/\s+/).every((word) => wordMatches(word, fullText, shortText));
}

export function matchesQuery(job: Job, query: JobQuery): boolean {
  if (query.q && !matchesText(job, query.q)) return false;
  if (query.company && !norm(job.company).includes(norm(query.company))) return false;
  if (query.regions?.length && !(job.regionId && query.regions.includes(job.regionId))) return false;
  if (query.cities?.length) {
    const c = job.city ? norm(job.city) : "";
    if (!query.cities.some((qc) => c.includes(norm(qc)))) return false;
  }
  if (query.categories?.length && !(job.categoryId && query.categories.includes(job.categoryId)))
    return false;
  if (
    query.employmentTypes?.length &&
    !(job.employmentType && query.employmentTypes.includes(job.employmentType))
  )
    return false;
  if (query.remote?.length && !(job.remote && query.remote.includes(job.remote))) return false;
  if (query.sources?.length && !query.sources.includes(job.sourceId)) return false;
  if (query.languages?.length && !(job.languages ?? []).some((l) => query.languages!.includes(l)))
    return false;
  if (query.salaryMin != null) {
    const s = annualizedSalary(job);
    if (s == null || s < query.salaryMin) return false;
  }
  if (query.salaryListed && job.salaryMin == null && job.salaryMax == null) return false;
  if (query.postedWithinDays != null) {
    const d = daysSince(job.postedAt ?? job.scrapedAt);
    if (d == null || d > query.postedWithinDays) return false;
  }
  if (query.postedSince) {
    const since = Date.parse(query.postedSince);
    const t = Date.parse(job.postedAt ?? job.scrapedAt ?? "");
    if (Number.isNaN(since) || Number.isNaN(t) || t < since) return false;
  }
  if (query.ccqOnly && !isCcqTrade(job.title)) return false;
  if (query.trades?.length) {
    const tradeId = ccqTradeOf(job.title)?.id;
    if (!tradeId || !query.trades.includes(tradeId)) return false;
  }
  if (query.shifts?.length) {
    const shift = detectShift(job.title, job.description);
    if (!shift || !query.shifts.includes(shift)) return false;
  }
  return true;
}

function compareBySort(sort: SortOption): (a: Job, b: Job) => number {
  switch (sort) {
    case "salary_desc":
      return (a, b) => (annualizedSalary(b) ?? -1) - (annualizedSalary(a) ?? -1);
    case "salary_asc":
      return (a, b) => (annualizedSalary(a) ?? Infinity) - (annualizedSalary(b) ?? Infinity);
    case "company":
      return (a, b) => a.company.localeCompare(b.company, "fr");
    case "recent":
    case "relevance":
    default:
      return (a, b) => {
        const ta = Date.parse(a.postedAt ?? a.scrapedAt);
        const tb = Date.parse(b.postedAt ?? b.scrapedAt);
        return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
      };
  }
}

/** Score de pertinence simple quand une requête texte est présente. */
function relevanceScore(job: Job, q: string): number {
  const needle = norm(q);
  const title = norm(job.title);
  const company = norm(job.company);
  let score = 0;
  if (title === needle) score += 100;
  if (title.includes(needle)) score += 40;
  if (company.includes(needle)) score += 15;
  for (const word of needle.split(/\s+/)) {
    if (title.includes(word)) score += 8;
    if ((job.tags ?? []).some((t) => norm(t).includes(word))) score += 4;
  }
  // Bonus fraîcheur
  const d = daysSince(job.postedAt);
  if (d != null) score += Math.max(0, 10 - d / 3);
  return score;
}

function countFacet(
  jobs: Job[],
  taxonomy: readonly { id: string; label: string }[],
  pick: (j: Job) => string | string[] | undefined,
): FacetCount[] {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const raw = pick(job);
    const ids = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const labelOf = new Map(taxonomy.map((t) => [t.id, t.label]));
  return [...counts.entries()]
    .map(([id, count]) => ({ id, label: labelOf.get(id) ?? id, count }))
    .sort((a, b) => b.count - a.count);
}

export function computeFacets(jobs: Job[]): JobFacets {
  const sourceCounts = new Map<string, number>();
  for (const j of jobs) sourceCounts.set(j.sourceId, (sourceCounts.get(j.sourceId) ?? 0) + 1);

  return {
    regions: countFacet(jobs, QUEBEC_REGIONS, (j) => j.regionId),
    categories: countFacet(jobs, JOB_CATEGORIES, (j) => j.categoryId),
    employmentTypes: countFacet(jobs, EMPLOYMENT_TYPES, (j) => j.employmentType),
    remote: countFacet(jobs, REMOTE_TYPES, (j) => j.remote),
    languages: countFacet(jobs, LANGUAGES, (j) => j.languages),
    sources: [...sourceCounts.entries()]
      .map(([id, count]) => ({ id, label: sourceName(id), count }))
      .sort((a, b) => b.count - a.count),
  };
}

/**
 * Applique une requête complète : filtrage → facettes → tri → pagination.
 * Logique unique partagée par l'API, le site et l'app.
 */
export function applyQuery(jobs: Job[], query: JobQuery): JobSearchResult {
  const filtered = collapseDuplicates(jobs.filter((j) => matchesQuery(j, query)));

  const facets = computeFacets(filtered);

  let sorted: Job[];
  if (query.sort === "relevance" && query.q) {
    sorted = [...filtered].sort((a, b) => relevanceScore(b, query.q!) - relevanceScore(a, query.q!));
  } else {
    sorted = [...filtered].sort(compareBySort(query.sort));
  }

  const total = sorted.length;
  const pageSize = query.pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * pageSize;
  const items = sorted.slice(start, start + pageSize);

  return { items, total, page, pageSize, totalPages, facets };
}

/** Agrège les offres par entreprise pour la vue « Qui recrute ». */
export function toHiringCompanies(jobs: Job[]): HiringCompany[] {
  const map = new Map<string, HiringCompany & { _cats: Set<string>; _regs: Set<string>; _srcs: Set<string> }>();
  for (const job of jobs) {
    const key = job.company.trim();
    if (!key) continue;
    let entry = map.get(norm(key));
    if (!entry) {
      entry = {
        company: key,
        companyLogoUrl: job.companyLogoUrl,
        openings: 0,
        categories: [],
        regions: [],
        sources: [],
        latestPostedAt: undefined,
        _cats: new Set(),
        _regs: new Set(),
        _srcs: new Set(),
      };
      map.set(norm(key), entry);
    }
    entry.openings += 1;
    if (job.categoryId) entry._cats.add(job.categoryId);
    if (job.regionId) entry._regs.add(job.regionId);
    entry._srcs.add(job.sourceId);
    if (!entry.companyLogoUrl && job.companyLogoUrl) entry.companyLogoUrl = job.companyLogoUrl;
    const posted = job.postedAt ?? job.scrapedAt;
    if (posted && (!entry.latestPostedAt || posted > entry.latestPostedAt)) {
      entry.latestPostedAt = posted;
    }
  }
  return [...map.values()]
    .map((e) => ({
      company: e.company,
      companyLogoUrl: e.companyLogoUrl,
      openings: e.openings,
      categories: [...e._cats],
      regions: [...e._regs],
      sources: [...e._srcs],
      latestPostedAt: e.latestPostedAt,
    }))
    .sort((a, b) => b.openings - a.openings);
}

/**
 * Employeurs proches : même région et/ou même domaine, hors l'employeur courant.
 * Sert la section « Employeurs similaires » des fiches entreprise.
 */
export function similarEmployers(
  current: HiringCompany,
  companies: HiringCompany[],
  limit = 6,
): HiringCompany[] {
  const mySources = new Set(current.sources);
  const myName = current.company.trim().toLowerCase();
  const myRegs = new Set(current.regions);
  const myCats = new Set(current.categories);
  return companies
    .filter((c) => {
      if (c.company.trim().toLowerCase() === myName) return false;
      if (c.sources.some((s) => mySources.has(s))) return false;
      return true;
    })
    .map((c) => {
      let score = 0;
      for (const r of c.regions) if (myRegs.has(r)) score += 2;
      for (const cat of c.categories) if (myCats.has(cat)) score += 2;
      return { c, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.c.openings - a.c.openings)
    .slice(0, limit)
    .map((s) => s.c);
}

/** Classement « qui recrute le plus » (optionnellement borné région / métier / domaine). */
export function rankHiringCompanies(
  jobs: Job[],
  opts?: { regionId?: string; categoryId?: string; tradeId?: string },
): HiringCompany[] {
  const filtered = jobs.filter((j) => {
    if (opts?.regionId && j.regionId !== opts.regionId) return false;
    if (opts?.categoryId && j.categoryId !== opts.categoryId) return false;
    if (opts?.tradeId && ccqTradeOf(j.title)?.id !== opts.tradeId) return false;
    return true;
  });
  return toHiringCompanies(filtered);
}

// Réexport des libellés utiles côté logique de filtrage.
export {
  labelForRegion,
  labelForCategory,
  labelForEmployment,
  labelForRemote,
  labelForLanguage,
};
