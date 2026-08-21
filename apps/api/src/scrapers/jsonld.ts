import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import { slugify } from "./util.js";

/** Nettoie un fragment HTML en texte simple tronqué. */
export function htmlToText(html?: string, maxLen = 600): string | undefined {
  if (!html) return undefined;
  const text = cheerio
    .load(`<div>${html}</div>`)("div")
    .text()
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return undefined;
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

const EMPLOYMENT_MAP: Record<string, RawJob["employmentType"]> = {
  FULL_TIME: "temps-plein",
  PART_TIME: "temps-partiel",
  CONTRACTOR: "contrat",
  TEMPORARY: "contrat",
  INTERN: "stage",
  SEASONAL: "saisonnier",
  PER_DIEM: "occasionnel",
};

const SALARY_UNIT_MAP: Record<string, RawJob["salaryPeriod"]> = {
  HOUR: "heure",
  WEEK: "semaine",
  MONTH: "mois",
  YEAR: "annee",
};

function first<T>(v: T | T[] | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function asString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return undefined;
}

/**
 * Décode les entités HTML d'un texte JSON-LD (ex. titre « …d&#x27;engrais »
 * → « …d'engrais »). Les valeurs JSON-LD sont des chaînes brutes (contrairement
 * au texte extrait via cheerio), donc les entités y survivent sans ça.
 */
function decodeEntities(s: string): string {
  if (!s.includes("&")) return s;
  return cheerio.load(`<x>${s}</x>`)("x").text();
}

/**
 * Aplati les structures @graph / tableaux / ItemList pour retrouver tous les
 * noeuds. Beaucoup de pages emballent leurs JobPosting dans un `ItemList`
 * (`itemListElement`), parfois via un `ListItem` (`item`) — on descend donc
 * aussi dans ces conteneurs, sinon les offres passent inaperçues.
 */
function collectNodes(data: unknown, out: Record<string, unknown>[], depth = 0): void {
  if (depth > 8) return; // garde-fou (structures profondes/répétées)
  if (Array.isArray(data)) {
    for (const item of data) collectNodes(item, out, depth + 1);
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    out.push(obj);
    if ("@graph" in obj) collectNodes(obj["@graph"], out, depth + 1);
    if ("itemListElement" in obj) collectNodes(obj["itemListElement"], out, depth + 1);
    if ("item" in obj) collectNodes(obj["item"], out, depth + 1);
  }
}

function isJobPosting(node: Record<string, unknown>): boolean {
  const type = node["@type"];
  if (typeof type === "string") return type === "JobPosting";
  if (Array.isArray(type)) return type.includes("JobPosting");
  return false;
}

function mapNode(node: Record<string, unknown>, sourceId: string, baseUrl: string): RawJob | null {
  const title = decodeEntities(asString(node.title) ?? "");
  const org = first(node.hiringOrganization) as Record<string, unknown> | undefined;
  const company = decodeEntities(asString(org?.name) ?? "");
  if (!title || !company) return null;

  let url = asString(node.url) ?? asString((node as Record<string, unknown>).sameAs) ?? baseUrl;
  // Plusieurs offres peuvent partager l'URL de la page (candidature par
  // courriel, page unique). On ajoute un fragment dérivé du titre pour éviter
  // les collisions d'identifiant (sinon une seule offre survit à l'upsert).
  const strip = (u: string) => u.replace(/#.*$/, "").replace(/\/+$/, "");
  if (strip(url) === strip(baseUrl)) url = `${strip(url)}#${slugify(title)}`;

  // Localisation
  let location: string | undefined;
  const loc = first(node.jobLocation) as Record<string, unknown> | undefined;
  const address = loc?.address as Record<string, unknown> | undefined;
  if (address) {
    location = [asString(address.addressLocality), asString(address.addressRegion)]
      .filter(Boolean)
      .join(", ");
  }
  const remoteType = asString(node.jobLocationType) === "TELECOMMUTE" ? "teletravail" : undefined;

  // Type d'emploi
  const empRaw = first(node.employmentType as string | string[] | undefined);
  const employmentType = empRaw ? EMPLOYMENT_MAP[empRaw.toUpperCase?.() ?? ""] : undefined;

  // Salaire
  let salaryMin: number | undefined;
  let salaryMax: number | undefined;
  let salaryPeriod: RawJob["salaryPeriod"];
  const baseSalary = node.baseSalary as Record<string, unknown> | undefined;
  const value = baseSalary?.value as Record<string, unknown> | undefined;
  if (value) {
    const min = Number(value.minValue);
    const max = Number(value.maxValue);
    const single = Number(value.value);
    if (Number.isFinite(min)) salaryMin = min;
    if (Number.isFinite(max)) salaryMax = max;
    if (!salaryMin && !salaryMax && Number.isFinite(single)) salaryMin = salaryMax = single;
    const unit = asString(value.unitText)?.toUpperCase();
    if (unit) salaryPeriod = SALARY_UNIT_MAP[unit];
  }

  const logo = asString((org?.logo as Record<string, unknown>)?.url) ?? asString(org?.logo);

  return {
    sourceId,
    url,
    title: title.trim(),
    company: company.trim(),
    location: location || undefined,
    remote: remoteType,
    employmentType,
    salaryMin,
    salaryMax,
    salaryPeriod,
    description: htmlToText(asString(node.description)),
    postedAt: asString(node.datePosted),
    tags: [],
    ...(logo ? { companyLogoUrl: logo } : {}),
  } as RawJob & { companyLogoUrl?: string };
}

/**
 * Extrait toutes les offres exposées en JSON-LD (schema.org JobPosting)
 * dans une page. C'est la méthode la plus fiable quand la source le fournit.
 */
export function extractJsonLdJobs(html: string, sourceId: string, baseUrl: string): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw.trim()) return;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return; // bloc JSON-LD invalide : on ignore
    }
    const nodes: Record<string, unknown>[] = [];
    collectNodes(data, nodes);
    for (const node of nodes) {
      if (!isJobPosting(node)) continue;
      const job = mapNode(node, sourceId, baseUrl);
      if (job) jobs.push(job);
    }
  });
  return jobs;
}
