import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { extractJsonLdJobs } from "./jsonld.js";
import { cleanText, mapEmploymentType, slugify } from "./util.js";

/**
 * Fabrique un scraper pour une **page carrières d'entreprise** (employeur) :
 * une seule page liste les postes ouverts. On tente d'abord les données
 * structurées JSON-LD, puis un repli HTML qui cible les liens de fiches de
 * poste. Idéal pour ajouter rapidement un employeur au répertoire.
 *
 * Statut recommandé : `experimental` (les sélecteurs du repli HTML doivent
 * être validés contre le DOM réel de chaque site).
 */
export interface CareersScraperConfig {
  id: string;
  company: string;
  careersUrl: string;
  /**
   * Motif d'URL identifiant une fiche de poste (ex. /\/emploi-/). Si fourni,
   * le repli HTML ne retient que les liens correspondants — plus précis que
   * l'heuristique générique (emploi|poste|carriere|job).
   */
  jobPathPattern?: RegExp;
}

function absolute(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function sameUrl(a: string, b: string): boolean {
  return a.replace(/\/+$/, "") === b.replace(/\/+$/, "");
}

/** Mots-clés qui trahissent un type de poste (donc une carte d'offre). */
const JOB_TYPE_RE =
  /temps\s*plein|temps\s*partiel|permanent|contractuel|contrat|saisonnier|temporaire|\d+\s*h\b|\d+\s*heures|\bstage\b|\bccq\b/i;

/**
 * Repli pour les sites **Wix** : les postes sont rendus dans un
 * `.wixui-repeater`, chaque item portant en général 3 blocs de texte
 * (titre, lieu, type) et un lien vers la fiche. On isole les items qui
 * ressemblent à des offres (présence d'un type de poste) pour éviter les
 * autres répéteurs de la page (avantages, équipe, témoignages…).
 */
function parseWixRepeaters(
  html: string,
  baseUrl: string,
  careersUrl: string,
  id: string,
  company: string,
): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $(".wixui-repeater").each((_, rep) => {
    const $rep = $(rep);
    const inner = $rep.children().first();
    const items = inner.children().length ? inner.children() : $rep.children();

    items.each((_, item) => {
      const $item = $(item);
      const texts = [
        ...new Set(
          $item
            .find("h1,h2,h3,h4,h5,h6")
            .map((_, h) => cleanText($(h).text()))
            .get()
            .filter(Boolean),
        ),
      ];
      // Une offre : un titre + au moins un autre bloc, dont un type de poste.
      if (texts.length < 2 || !texts.some((t) => JOB_TYPE_RE.test(t))) return;

      const title = texts[0]!;
      if (title.length < 3 || title.length > 140) return;

      const detail = $item
        .find("a[href]")
        .map((_, a) => $(a).attr("href") || "")
        .get()
        .find((h) => /^https?:\/\//.test(h) && !/facebook|instagram|linkedin\.com|youtube|mailto:|tel:/i.test(h));
      const url = (detail ? absolute(detail.split("#")[0] ?? "", baseUrl) : `${careersUrl}#${slugify(title)}`);
      if (seen.has(url)) return;

      let type: string | undefined;
      let location: string | undefined;
      for (const t of texts.slice(1)) {
        if (!type && JOB_TYPE_RE.test(t)) type = t;
        else if (!location) location = t;
      }

      seen.add(url);
      jobs.push({
        sourceId: id,
        url,
        title,
        company,
        location,
        employmentType: mapEmploymentType(type),
        tags: [],
      });
    });
  });

  return jobs;
}

const NAV_LABELS =
  /^(carrières|carrieres|postuler|en savoir plus|voir|voir l'offre|accueil|contact|nous joindre|emplois|carrière)$/i;

function parseHtmlCareers(
  html: string,
  baseUrl: string,
  careersUrl: string,
  id: string,
  company: string,
  jobPathPattern?: RegExp,
): RawJob[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const jobs: RawJob[] = [];

  const selector = jobPathPattern
    ? "a[href]"
    : 'a[href*="carriere"], a[href*="emploi"], a[href*="poste"], a[href*="/job"]';

  $(selector).each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (jobPathPattern && !jobPathPattern.test(href)) return;
    const url = absolute((href.split("#")[0] ?? "").trim(), baseUrl);
    if (sameUrl(url, careersUrl)) return; // ignore la page index elle-même
    if (seen.has(url)) return;

    const title = ($(el).text() || $(el).attr("title") || "").replace(/\s+/g, " ").trim();
    if (!title || title.length < 3 || title.length > 120) return;
    if (NAV_LABELS.test(title)) return;

    seen.add(url);
    jobs.push({ sourceId: id, url, title, company, tags: [] });
  });

  return jobs;
}

export function makeCareersScraper(config: CareersScraperConfig): Scraper {
  return {
    id: config.id,

    parseList(html: string, baseUrl: string): RawJob[] {
      const jsonld = extractJsonLdJobs(html, config.id, baseUrl);
      if (jsonld.length > 0) return jsonld;
      const wix = parseWixRepeaters(html, baseUrl, config.careersUrl, config.id, config.company);
      if (wix.length > 0) return wix;
      return parseHtmlCareers(
        html,
        baseUrl,
        config.careersUrl,
        config.id,
        config.company,
        config.jobPathPattern,
      );
    },

    async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
      ctx.log(`${config.id} — page carrières : ${config.careersUrl}`);
      let html: string;
      try {
        html = await ctx.fetchHtml(config.careersUrl);
      } catch (err) {
        ctx.log(`${config.id} — échec : ${(err as Error).message}`);
        return [];
      }
      const jobs = this.parseList!(html, config.careersUrl);
      ctx.log(`${config.id} — ${jobs.length} poste(s) trouvé(s)`);
      return jobs;
    },
  };
}
