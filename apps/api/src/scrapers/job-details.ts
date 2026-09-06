import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import { parseSalary } from "../normalize.js";
import { extractJsonLdJobs } from "./jsonld.js";
import type { ScrapeContext } from "./types.js";
import { cleanText, mapEmploymentType } from "./util.js";

const DESC_MAX = 8000;
const DETAIL_CAP = 20;

const BINARY_URL = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|jpe?g|png|gif|webp|svg|mp4|mov)(\?|#|$)/i;

const VAGUE_LIEU =
  /^(d[ée]placements?\s+fr[ée]quents?|selon|variable|plusieurs|territoire|a d[ée]terminer|partout|n\/?a|—|-)$/i;

const HOME_NOISE =
  /demande de soumission|évaluation gratuite|prix des plus comp[eé]titif|approbation sur place/i;

const JOB_BODY =
  /nous recherchons|description de l['’]opportunit|responsabilit|t[aâ]ches?\s*:|exigences?|avantages?\s+offerts|le candidat/i;

/** Villes QC souvent citées dans les fiches (pas les régions). */
const CITY_RE =
  /\b(montr[eé]al|laval|longueuil|gatineau|sherbrooke|l[eé]vis|saguenay|chicoutimi|jonqui[eè]re|trois-rivi[eè]res|terrebonne|repentigny|joliette|drummondville|saint-j[eé]r[oô]me|granby|blainville|shawinigan|rimouski|baie-comeau|sept-[iî]les|alma|val-d['’]or|rouyn-noranda|saint-jean-baptiste|h[eé]rouxville)\b/gi;

export interface JobDetails {
  description?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryPeriod?: RawJob["salaryPeriod"];
  employmentType?: RawJob["employmentType"];
  postedAt?: string;
}

function looksBinary(html: string): boolean {
  return html.includes("\u0000") || /^%PDF-/.test(html);
}

/** Texte principal d'une fiche (sans nav/pied de page). */
export function mainContentText(html: string): string | undefined {
  if (looksBinary(html)) return undefined;
  const $ = cheerio.load(html);
  $("script,style,nav,header,footer,form,svg,noscript,aside,.menu,.nav,.navbar,.header,.footer,.breadcrumb,.cookie,.share,.social").remove();

  const chunks: string[] = [];
  $(
    "[class*=job-description], [class*=job_description], .elementor-widget-text-editor, article, main, [role=main], .entry-content, .post-content",
  ).each((_, el) => {
    const t = cleanText($(el).text());
    if (t.length >= 80) chunks.push(t);
  });

  let best = chunks.sort((a, b) => b.length - a.length)[0] ?? "";
  if (best.length < 120) best = cleanText($("body").text());
  if (best.length < 80) return undefined;
  return best.length > DESC_MAX ? `${best.slice(0, DESC_MAX - 1)}…` : best;
}

function labeledLocation(text: string): string | undefined {
  const m = text.match(/\b(?:lieu(?: du poste)?|ville|localisation|endroits?|r[ée]gion)\s*:\s*([^\n.]{3,80})/i);
  if (!m) return undefined;
  const loc = cleanText(m[1] ?? "");
  if (!loc || VAGUE_LIEU.test(loc) || HOME_NOISE.test(loc)) return undefined;
  return loc;
}

function citiesFromText(text: string): string | undefined {
  const seen = new Set<string>();
  const cities: string[] = [];
  for (const raw of text.matchAll(CITY_RE)) {
    const name = raw[1]!;
    const key = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (seen.has(key)) continue;
    // « Québec » seul dans un pied de page / décret : trop ambigu.
    if (key === "quebec" && !/,\s*qc\b|ville de qu[eé]bec|qu[eé]bec\s*,/i.test(text)) continue;
    seen.add(key);
    cities.push(name[0]!.toUpperCase() + name.slice(1));
  }
  if (!cities.length) return undefined;
  const joined = cities.join(", ");
  return /,\s*qc\b/i.test(joined) ? joined : `${joined}, QC`;
}

/** Complète salaire / type / lieu à partir d'un texte déjà extrait (liste ou fiche). */
export function detailsFromText(text: string): JobDetails {
  const salary = parseSalary(text);
  // Un montant annuel (50 000 $) ne doit pas devenir « /heure » parce que
  // le texte contient aussi « horaire » ou « 35 heures ».
  if (salary && (salary.salaryMin ?? salary.salaryMax ?? 0) > 1000 && salary.salaryPeriod === "heure") {
    salary.salaryPeriod = "annee";
  }
  const employmentType =
    /temps\s*plein/i.test(text) && /temps\s*partiel/i.test(text)
      ? "temps-plein"
      : mapEmploymentType(text);
  return {
    description: text.length >= 80 ? (text.length > DESC_MAX ? `${text.slice(0, DESC_MAX - 1)}…` : text) : undefined,
    location: labeledLocation(text) ?? citiesFromText(text),
    employmentType,
    ...(salary ?? {}),
  };
}

/** Extrait description, salaire et villes d'une page de fiche (JSON-LD puis HTML). */
export function extractJobDetails(html: string, sourceId: string, url: string): JobDetails {
  const ld = extractJsonLdJobs(html, sourceId, url).find((j) => j.description || j.location || j.salaryMin != null);
  const body = mainContentText(html);
  if (body && HOME_NOISE.test(body) && !JOB_BODY.test(body)) {
    return ld
      ? {
          description: ld.description,
          location: ld.location,
          salaryMin: ld.salaryMin,
          salaryMax: ld.salaryMax,
          salaryPeriod: ld.salaryPeriod,
          employmentType: ld.employmentType,
          postedAt: ld.postedAt,
        }
      : {};
  }
  const fromText = detailsFromText(body ?? "");
  return {
    description: ld?.description && ld.description.length >= 80 ? ld.description : fromText.description,
    location: ld?.location || fromText.location,
    salaryMin: ld?.salaryMin ?? fromText.salaryMin,
    salaryMax: ld?.salaryMax ?? fromText.salaryMax,
    salaryPeriod: ld?.salaryPeriod ?? fromText.salaryPeriod,
    employmentType: ld?.employmentType ?? fromText.employmentType,
    postedAt: ld?.postedAt,
  };
}

function pickLocation(current?: string, next?: string): string | undefined {
  if (!next || VAGUE_LIEU.test(next)) return current;
  if (!current) return next;
  const nextCities = next.split(",").length;
  const curCities = current.split(",").length;
  return nextCities > curCities ? next : current;
}

/** Fusionne les détails dans une offre sans écraser un champ déjà utile. */
export function mergeJobDetails(job: RawJob, details: JobDetails): RawJob {
  return {
    ...job,
    description: job.description || details.description,
    location: pickLocation(job.location, details.location),
    salaryMin: job.salaryMin ?? details.salaryMin,
    salaryMax: job.salaryMax ?? details.salaryMax,
    salaryPeriod: job.salaryPeriod ?? details.salaryPeriod,
    employmentType: job.employmentType ?? details.employmentType,
    postedAt: job.postedAt ?? details.postedAt,
  };
}

function samePath(a: string, b: string): boolean {
  const strip = (u: string) => u.replace(/[?#].*$/, "").replace(/\/+$/, "");
  return strip(a) === strip(b);
}

/**
 * Récupère chaque fiche (URL réelle, hors PDF / ancre) et y lit description,
 * salaire et villes. À appeler depuis `scrape` après `parseList`.
 */
export async function enrichJobsFromDetails(
  jobs: RawJob[],
  ctx: ScrapeContext,
  opts: { listUrl?: string; userAgent?: string; cap?: number } = {},
): Promise<RawJob[]> {
  const cap = opts.cap ?? DETAIL_CAP;
  let n = 0;
  const out: RawJob[] = [];
  for (const job of jobs) {
    const needs = !job.description || job.salaryMin == null || !job.location;
    if (
      !needs ||
      n >= cap ||
      !/^https?:\/\//i.test(job.url) ||
      job.url.includes("#") ||
      BINARY_URL.test(job.url) ||
      (opts.listUrl && samePath(job.url, opts.listUrl))
    ) {
      out.push(job.description ? mergeJobDetails(job, detailsFromText(job.description)) : job);
      continue;
    }
    n++;
    try {
      const html = await ctx.fetchHtml(job.url, opts.userAgent ? { userAgent: opts.userAgent } : undefined);
      out.push(mergeJobDetails(job, extractJobDetails(html, job.sourceId, job.url)));
    } catch {
      out.push(job);
    }
  }
  const withDesc = out.filter((j) => j.description).length;
  if (n > 0) ctx.log(`${jobs[0]?.sourceId ?? "scraper"} — fiches enrichies : ${withDesc}/${out.length}`);
  return out;
}
