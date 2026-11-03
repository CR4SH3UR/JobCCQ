import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import { extractJsonLdJobs, htmlToText } from "./jsonld.js";
import type { ScrapeContext } from "./types.js";
import { cleanText } from "./util.js";

/**
 * Enrichit les offres **sans description** (ou trop courtes) en récupérant
 * chaque fiche individuelle. Google for Jobs exige une vraie description :
 * un titre seul n'apparaît presque jamais.
 *
 * Ordre de priorité pour le texte :
 * 1. JSON-LD `JobPosting.description`
 * 2. Contenu principal de la page (article / job-description / main)
 *
 * Complète aussi lieu, salaire, type et date quand le JSON-LD les fournit et
 * que l'offre ne les a pas encore.
 */

const MIN_DESC = 80;

/** Page HTML trop courte / binaire → pas une fiche utile. */
function looksBinary(html: string): boolean {
  const head = html.slice(0, 2000);
  if (/^\s*%PDF-/.test(head)) return true;
  let bad = 0;
  for (let i = 0; i < head.length; i++) {
    const c = head.charCodeAt(i);
    if (c === 0xfffd || c < 9 || (c > 13 && c < 32)) bad++;
  }
  return bad / Math.max(1, head.length) > 0.02;
}

/**
 * Texte du contenu principal d'une fiche — repli quand il n'y a pas de JSON-LD.
 * Extrait depuis `careers.ts` pour partage entre scrapers / orchestrateur.
 */
export function mainContentText(html: string): string | undefined {
  if (looksBinary(html)) return undefined;
  const $ = cheerio.load(html);
  $(
    "script,style,nav,header,footer,form,svg,noscript,aside,.menu,.nav,.navbar,.header,.footer,.breadcrumb,.cookie,.share,.social,.related",
  ).remove();
  const candidates = [
    "[class*=job-description]",
    "[class*=job_description]",
    "[class*=offre-emploi]",
    "article",
    "main",
    "[role=main]",
    ".entry-content",
    ".single-content",
    ".post-content",
    ".content",
    "#content",
  ];
  let best = "";
  for (const sel of candidates) {
    $(sel).each((_, el) => {
      const t = cleanText($(el).text());
      if (t.length > best.length) best = t;
    });
    if (best.length >= 400) break;
  }
  if (best.length < 200) best = cleanText($("body").text());
  const leadNoise =
    /^\s*(aller au contenu|passer au contenu|skip to (main )?content|postuler( dès maintenant| now)?|partager(\s+l['’]offre)?|offres?\s+d['’]emplois?)\s*/i;
  let prev: string;
  do {
    prev = best;
    best = best.replace(leadNoise, "").trim();
  } while (best !== prev);
  if (best.length < 120) return undefined;
  return best.length > 4000 ? `${best.slice(0, 3999)}…` : best;
}

/** Description d'une fiche : JSON-LD d'abord, sinon contenu principal. */
export function extractDetailDescription(
  html: string,
  sourceId: string,
  url: string,
): string | undefined {
  const fromLd = extractJsonLdJobs(html, sourceId, url).find((j) => j.description)?.description;
  return fromLd ?? mainContentText(html);
}

function needsEnrichment(job: RawJob): boolean {
  return !job.description || job.description.trim().length < MIN_DESC;
}

function isFetchableDetailUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (url.includes("#")) return false;
  if (/\.(pdf|docx?|xlsx?|pptx?|zip|rar|jpe?g|png|gif|webp|svg|mp4|mov)(\?|$)/i.test(url))
    return false;
  return true;
}

/** Applique les champs du JSON-LD manquants sur l'offre. */
function mergeFromLd(job: RawJob, ld: RawJob): void {
  if (!job.location && ld.location) job.location = ld.location;
  if (job.salaryMin == null && ld.salaryMin != null) {
    job.salaryMin = ld.salaryMin;
    job.salaryMax = ld.salaryMax;
    job.salaryPeriod = ld.salaryPeriod;
  }
  if (!job.employmentType && ld.employmentType) job.employmentType = ld.employmentType;
  if (!job.postedAt && ld.postedAt) job.postedAt = ld.postedAt;
}

export interface EnrichDetailsOptions {
  /** Plafond de fiches récupérées par source (politesse). */
  cap?: number;
  /** UA forcé (certains ATS bloquent les bots). */
  userAgent?: string;
}

/**
 * Enrichit in-place les offres d'une source en visitant leurs fiches.
 * Retourne le nombre de fiches réellement récupérées.
 */
export async function enrichMissingDetails(
  jobs: RawJob[],
  sourceId: string,
  ctx: ScrapeContext,
  opts: EnrichDetailsOptions = {},
): Promise<number> {
  const cap = opts.cap ?? Number(process.env.SCRAPE_DETAIL_CAP ?? 40);
  let fetched = 0;
  for (const job of jobs) {
    if (fetched >= cap) break;
    if (!needsEnrichment(job) && job.location) continue;
    if (!isFetchableDetailUrl(job.url)) continue;
    fetched++;
    try {
      const html = await ctx.fetchHtml(job.url, opts.userAgent ? { userAgent: opts.userAgent } : undefined);
      const ld = extractJsonLdJobs(html, sourceId, job.url).find(
        (j) => j.description || j.location || j.salaryMin != null,
      );
      if (!job.description || job.description.trim().length < MIN_DESC) {
        job.description = ld?.description ?? mainContentText(html) ?? job.description;
      }
      if (ld) mergeFromLd(job, ld);
    } catch {
      /* fiche inaccessible → on garde l'offre en l'état */
    }
  }
  if (fetched > 0) {
    const n = jobs.filter((j) => j.description && j.description.length >= MIN_DESC).length;
    ctx.log(`${sourceId} — descriptions enrichies : ${n}/${jobs.length} (fiches lues : ${fetched})`);
  }
  return fetched;
}

/**
 * Parse la réponse JSON BambooHR `/careers/{id}/detail` → description texte.
 * Retourne `undefined` si le payload n'est pas du JSON utile.
 */
export function parseBambooHrDetail(json: string): {
  description?: string;
  location?: string;
  employmentTypeLabel?: string;
} | null {
  let data: {
    result?: {
      jobOpening?: {
        description?: string;
        location?: { city?: string; state?: string };
        employmentStatusLabel?: string;
      };
    };
  };
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  const opening = data?.result?.jobOpening;
  if (!opening) return null;
  const description = htmlToText(opening.description, 4000);
  const city = cleanText(opening.location?.city);
  const state = cleanText(opening.location?.state);
  const location = [city, state].filter(Boolean).join(", ") || undefined;
  return {
    description: description || undefined,
    location,
    employmentTypeLabel: cleanText(opening.employmentStatusLabel) || undefined,
  };
}
