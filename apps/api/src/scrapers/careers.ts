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
      // Une offre = un item « titre + lieu + type » (peu de blocs). Un item qui
      // contient une longue liste d'intitulés n'est PAS une offre unique : on le
      // laisse au repli « titres ».
      if (texts.length < 2 || texts.length > 5 || !texts.some((t) => JOB_TYPE_RE.test(t))) return;

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

/**
 * Mots qui identifient un **titre de poste de la construction** dans un simple
 * intitulé (h2/h3…). Dernier repli pour les petites pages carrières
 * (Wix/WordPress) qui listent les postes en titres, sans données structurées,
 * lien ni type par poste.
 */
const JOB_TITLE_HINT =
  /op[ée]rateur|man(?:œ|oe)uvre|contrema[iî]tre|chef\s+d['’]?\s*[ée]quipe|estimateur|charg[ée] de projet|m[ée]canicien|charpentier|menuisier|arpenteur|camionneur|chauffeur|journalier|soudeur|grutier|coffreur|cimentier|ferrailleur|foreur|signaleur|apprenti|[ée]lectricien|plombier|couvreur|poseur|technicien|ing[ée]nieur|superviseur|coordonnateur|adjoint|commis|acheteur|magasinier|conducteur|d[ée]neigement|pav(?:age|eur|é)|briqueteur|ma[çc]on|terrassement|excavation|b[ée]ton|aqueduc|voirie|drainage|foreman/i;

/** Suffixe de raison sociale — un « titre » qui finit ainsi est un nom d'entreprise, pas un poste. */
const COMPANY_SUFFIX = /\b(inc|lt[ée]e|ltd|limit[ée]e|senc|enr|corp)\.?$/i;

const SECTION_LABEL =
  /postes?\s+(?:disponibles|ouverts)|nos emplois|offres? d'emploi|postulez|candidature|pourquoi|avantages/i;

/** Repli « titres » : chaque intitulé qui ressemble à un poste devient une offre. */
function parseHeadingJobs(html: string, careersUrl: string, id: string, company: string): RawJob[] {
  const $ = cheerio.load(html);
  const out = new Map<string, RawJob>();
  const base = careersUrl.replace(/\/+$/, "");

  const add = (title: string) => {
    const t = cleanText(title.replace(/^[-–—•*\s]+/, ""));
    if (t.length < 4 || t.length > 110) return;
    if (!JOB_TITLE_HINT.test(t) || SECTION_LABEL.test(t)) return;
    if (COMPANY_SUFFIX.test(t)) return; // « … inc./ltée » = nom d'entreprise, pas un poste
    const url = `${base}#${slugify(t)}`;
    if (!out.has(url)) out.set(url, { sourceId: id, url, title: t, company, tags: [] });
  };

  // h1-h5 + intitulés en gras (<strong>/<b>) : certains sites listent les postes
  // en gras sous une section « Postes », sans titres ni liens.
  $("h1,h2,h3,h4,h5,strong,b").each((_, el) => {
    const raw = cleanText($(el).text());
    if (raw.length < 4) return;
    // Certaines pages listent plusieurs postes dans un même intitulé
    // (« - Contremaître - Charpentier - Manœuvre »). On sépare ces énumérations.
    const parts = raw.split(/\s+[-–—•|]\s+/).filter(Boolean);
    if (parts.length > 1) parts.forEach(add);
    else add(raw);
  });
  return [...out.values()];
}

export function makeCareersScraper(config: CareersScraperConfig): Scraper {
  return {
    id: config.id,

    parseList(html: string, baseUrl: string): RawJob[] {
      const jsonld = extractJsonLdJobs(html, config.id, baseUrl);
      if (jsonld.length > 0) return jsonld;
      const wix = parseWixRepeaters(html, baseUrl, config.careersUrl, config.id, config.company);
      if (wix.length > 0) return wix;
      // Si la source expose un motif de lien de poste (ex. /emploi-…), on le
      // privilégie (vraies URLs de fiches). Sinon on lit les titres.
      if (config.jobPathPattern) {
        const links = parseHtmlCareers(
          html,
          baseUrl,
          config.careersUrl,
          config.id,
          config.company,
          config.jobPathPattern,
        );
        if (links.length > 0) return links;
      }
      const heads = parseHeadingJobs(html, config.careersUrl, config.id, config.company);
      if (heads.length > 0) return heads;
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
