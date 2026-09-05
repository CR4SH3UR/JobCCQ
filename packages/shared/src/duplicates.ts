/**
 * Doublons inter-sources : même poste publié sur deux portails (carrières
 * employeur + Jobillico, deux fiches discovered, etc.). Clé stable, fusion
 * dans `applyQuery`, badge « aussi sur X » sur la fiche conservée.
 */
import type { Job } from "./types.js";
import { normalizeText } from "./text.js";
import { jobCompleteness } from "./completeness.js";
import { getEmployer } from "./sources.js";

export interface DuplicateAlt {
  id: string;
  sourceId: string;
  url: string;
}

const LEGAL = /\b(inc|incorporated|ltee|ltd|limited|cie|co|senc|sencrl|s\.?e\.?n\.?c)\b\.?/g;

/** Entreprise comparable : minuscule, sans forme juridique. */
export function normalizeCompany(name: string): string {
  return normalizeText(name)
    .replace(LEGAL, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Titre comparable : sans lieu collé (« … - Montréal », « … (Laval) »). */
export function normalizeTitle(title: string): string {
  return normalizeText(title)
    .replace(/\s*[-–|/]\s+[^-–|/]{2,40}$/g, "")
    .replace(/\s*\([^)]{2,40}\)\s*$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function placeKey(job: Job): string {
  if (job.city) return normalizeText(job.city).replace(/[^a-z0-9]+/g, " ").trim();
  return job.regionId ?? "";
}

/** Clé de regroupement, ou `""` si trop pauvre pour fusionner. */
export function duplicateKey(job: Job): string {
  const title = normalizeTitle(job.title);
  const company = normalizeCompany(job.company);
  if (!title || !company) return "";
  return `${company}|${title}|${placeKey(job)}`;
}

function toAlt(job: Job): DuplicateAlt {
  return { id: job.id, sourceId: job.sourceId, url: job.url };
}

function rank(job: Job): number {
  let n = jobCompleteness(job).score * 10;
  n += Math.min(8, Math.floor((job.description?.length ?? 0) / 80));
  if (getEmployer(job.sourceId)?.verified) n += 5;
  return n;
}

/** Représentant du groupe : fiche la plus complète, puis employeur vérifié. */
export function pickCanonical(group: Job[]): Job {
  return [...group].sort((a, b) => {
    const d = rank(b) - rank(a);
    if (d !== 0) return d;
    return a.id.localeCompare(b.id);
  })[0]!;
}

/**
 * Groupes de 2+ offres, **sources distinctes**, même clé. Une source qui
 * publie deux « Charpentier » à Montréal n'est pas un doublon.
 */
export function duplicateGroups(jobs: Job[]): Job[][] {
  const buckets = new Map<string, Job[]>();
  for (const job of jobs) {
    const key = duplicateKey(job);
    if (!key) continue;
    const list = buckets.get(key);
    if (list) list.push(job);
    else buckets.set(key, [job]);
  }
  const out: Job[][] = [];
  for (const group of buckets.values()) {
    if (group.length < 2) continue;
    const sources = new Set(group.map((j) => j.sourceId));
    if (sources.size >= 2) out.push(group);
  }
  return out;
}

/** Annote `alsoOn` sans retirer l'offre (fiche détail d'un doublon). */
export function attachDuplicateAlts(job: Job, all: Job[]): Job {
  const key = duplicateKey(job);
  if (!key) return job;
  const group = all.filter((j) => j.id !== job.id && duplicateKey(j) === key);
  const alts = group.filter((j) => j.sourceId !== job.sourceId).map(toAlt);
  return alts.length ? { ...job, alsoOn: alts } : job;
}

/**
 * Une offre par groupe (la plus complète), avec `alsoOn` vers les autres
 * sources. Les offres hors groupe restent telles quelles.
 */
export function collapseDuplicates(jobs: Job[]): Job[] {
  const groups = duplicateGroups(jobs);
  if (groups.length === 0) return jobs;

  const hidden = new Set<string>();
  const alts = new Map<string, DuplicateAlt[]>();
  for (const group of groups) {
    const keep = pickCanonical(group);
    alts.set(
      keep.id,
      group.filter((j) => j.id !== keep.id).map(toAlt),
    );
    for (const j of group) {
      if (j.id !== keep.id) hidden.add(j.id);
    }
  }

  return jobs
    .filter((j) => !hidden.has(j.id))
    .map((j) => {
      const extra = alts.get(j.id);
      return extra?.length ? { ...j, alsoOn: extra } : j;
    });
}
