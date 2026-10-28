import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { htmlToText } from "./jsonld.js";
import { mapSalaryUnit, slugify } from "./util.js";

/**
 * Quantum (quantum.ca) — agence de recrutement. Les pages d'offre exposent un
 * JSON-LD schema.org `JobPosting` complet (titre, lieu, dates, description),
 * d'où un « scraper de description » : on lit ce bloc plutôt que le HTML rendu
 * (le portail SourceFlow charge la liste en JavaScript).
 *
 * Deux particularités du flux Quantum, traitées ici :
 *  1. `hiringOrganization` ne porte pas de nom (l'agence masque l'employeur
 *     final) → on force la société à « Quantum ».
 *  2. La `description` est DOUBLE-échappée dans le <script> (« &amp;#233; »),
 *     donc on décode les entités jusqu'à stabilité pour retrouver « é », « – »,
 *     « ' »… (le repli CP1252 d'htmlparser2 mappe &#150;→« – », &#146;→« ' »).
 */
const ID = "quantum-ca";
const COMPANY = "Quantum";
const CAREERS_URL =
  "https://quantum.ca/jobs/1002981-Contremaitre-de-chantier-travaux-civil-/";

const EMPLOYMENT_MAP: Record<string, RawJob["employmentType"]> = {
  FULL_TIME: "temps-plein",
  PART_TIME: "temps-partiel",
  CONTRACTOR: "contrat",
  TEMPORARY: "contrat",
  INTERN: "stage",
  SEASONAL: "saisonnier",
  PER_DIEM: "occasionnel",
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
 * Décode les entités HTML d'une chaîne JSON-LD jusqu'à stabilité (max 3 passes).
 * Nécessaire car Quantum sérialise la description en double-échappé.
 */
function decodeDeep(s: string, max = 3): string {
  let out = s;
  for (let i = 0; i < max; i++) {
    const next = cheerio.load(`<x>${out}</x>`)("x").text();
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * Convertit un fragment HTML en texte en PRÉSERVANT les sauts de ligne de bloc
 * (`<br>`, fins de `<p>`/`<li>`/`<div>`/titres). Le `htmlToText` partagé écrase
 * tous les blancs en une espace ; ici on garde la structure (sections, puces)
 * pour une description lisible. Tronque sur une frontière de mot/ligne.
 */
function richHtmlToText(html: string, maxLen = 2000): string | undefined {
  if (!html) return undefined;
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n");
  const raw = cheerio.load(`<div>${withBreaks}</div>`)("div").text();
  const cleaned = raw
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim()) // espaces/tabs/nbsp intra-ligne
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // au plus une ligne vide
    .replace(/^\s+|\s+$/g, "");
  if (!cleaned) return undefined;
  if (cleaned.length <= maxLen) return cleaned;
  const cut = cleaned.slice(0, maxLen);
  const boundary = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(" "));
  const end = boundary >= maxLen * 0.6 ? boundary : maxLen - 1;
  return `${cut.slice(0, end).trimEnd()}…`;
}

/**
 * Description lisible depuis le corps HTML de la page : Quantum conserve la
 * vraie mise en forme dans `.post-content` (sauts de ligne, puces « - »), alors
 * que la description du JSON-LD est aplatie sans séparateur (mots collés
 * « RigaudTu… »). On retient le `.post-content` le plus long (le corps de
 * l'offre) ; repli sur le JSON-LD si le bloc est absent ou trop court.
 */
function descriptionFromBody($: cheerio.CheerioAPI): string | undefined {
  let html = "";
  $(".post-content").each((_, el) => {
    const h = $(el).html() ?? "";
    if (h.length > html.length) html = h;
  });
  const text = richHtmlToText(html);
  return text && text.length >= 120 ? text : undefined;
}

/** Aplati @graph / tableaux / ItemList pour retrouver tous les JobPosting. */
function collectNodes(data: unknown, out: Record<string, unknown>[], depth = 0): void {
  if (depth > 8) return;
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

/**
 * Parseur PUR : page d'offre Quantum → offres, à partir du JSON-LD JobPosting.
 * Aucun réseau — testable hors-ligne avec une fixture.
 */
export function parseQuantum(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  const strip = (u: string) => u.replace(/#.*$/, "").replace(/\/+$/, "");
  // Une page Quantum = une offre : la description du corps vaut pour le poste.
  const bodyDescription = descriptionFromBody($);

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

      const title = decodeDeep(asString(node.title) ?? "").trim();
      if (!title) continue;

      // URL propre de l'offre ; fragment stable si deux offres partagent la page.
      let url = asString(node.url) ?? baseUrl;
      if (seen.has(strip(url))) url = `${strip(url)}#${slugify(title)}`;
      if (seen.has(url)) continue;
      seen.add(url);
      seen.add(strip(url));

      // Lieu : localité + région (Quantum ne remplit souvent que la région).
      let location: string | undefined;
      const loc = first(node.jobLocation) as Record<string, unknown> | undefined;
      const address = loc?.address as Record<string, unknown> | undefined;
      if (address) {
        location =
          [asString(address.addressLocality), asString(address.addressRegion)]
            .filter(Boolean)
            .join(", ") || undefined;
      }

      const empRaw = first(node.employmentType as string | string[] | undefined);
      const employmentType = empRaw ? EMPLOYMENT_MAP[empRaw.toUpperCase?.() ?? ""] : undefined;

      // Salaire : souvent absent ou sans valeur chez Quantum — on n'ajoute la
      // période que si un montant est réellement présent.
      let salaryMin: number | undefined;
      let salaryMax: number | undefined;
      let salaryPeriod: RawJob["salaryPeriod"];
      const value = (node.baseSalary as Record<string, unknown> | undefined)?.value as
        | Record<string, unknown>
        | undefined;
      if (value) {
        const min = Number(value.minValue);
        const max = Number(value.maxValue);
        const single = Number(value.value);
        if (Number.isFinite(min)) salaryMin = min;
        if (Number.isFinite(max)) salaryMax = max;
        if (salaryMin == null && salaryMax == null && Number.isFinite(single)) {
          salaryMin = salaryMax = single;
        }
        if (salaryMin != null || salaryMax != null) {
          salaryPeriod = mapSalaryUnit(asString(value.unitText));
        }
      }

      jobs.push({
        sourceId: ID,
        url,
        title,
        company: COMPANY,
        location,
        employmentType,
        salaryMin,
        salaryMax,
        salaryPeriod,
        // Corps HTML lisible en priorité ; repli sur le JSON-LD (double-décodé).
        description: bodyDescription ?? htmlToText(decodeDeep(asString(node.description) ?? ""), 2000),
        postedAt: asString(node.datePosted),
        tags: [],
      });
    }
  });

  return jobs;
}

export const quantumScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseQuantum(html, baseUrl || CAREERS_URL),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page d'offre : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL);
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseQuantum(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
