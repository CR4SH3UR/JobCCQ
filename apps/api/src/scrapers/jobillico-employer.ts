import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { extractJsonLdJobs } from "./jsonld.js";
import { cleanText } from "./util.js";

/**
 * Scraper d'une **page employeur Jobillico** (un seul entrepreneur), pour rester
 * ciblé construction sans réactiver l'agrégateur généraliste.
 *
 * La page (`…/voir-entreprise/…` ou `…/employeurs/…/voir-liste-emplois`) expose
 * un JSON-LD `ItemList` (URL + titre de chaque poste). On enrichit ensuite
 * chaque fiche via son `JobPosting` (lieu, salaire, description).
 */
export interface JobillicoEmployerConfig {
  id: string;
  company: string;
  /** URL de la liste des postes de l'employeur sur Jobillico. */
  listUrl: string;
  /** Nb max de fiches détaillées récupérées (politesse). */
  detailCap?: number;
}

interface Listed {
  url: string;
  name: string;
}

/** Extrait les postes de l'ItemList (URL + titre). */
export function parseEmployerItemList(html: string): Listed[] {
  const $ = cheerio.load(html);
  const out = new Map<string, Listed>();
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw.includes("ItemList")) return;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    const lists = Array.isArray(data) ? data : [data];
    for (const node of lists as Array<Record<string, unknown>>) {
      const items = node?.itemListElement;
      if (!Array.isArray(items)) continue;
      for (const it of items as Array<Record<string, unknown>>) {
        const href = typeof it.url === "string" ? it.url : undefined;
        if (!href || !/offre-d?-?emploi/i.test(href)) continue;
        const url = href.split("?")[0]!;
        out.set(url, { url, name: cleanText(typeof it.name === "string" ? it.name : "") });
      }
    }
  });
  return [...out.values()];
}

/** Slug de l'employeur dans l'URL (…/employeurs/<slug>/…). */
function employerSlug(listUrl: string): string | undefined {
  return listUrl.match(/\/employeurs\/([^/]+)\//)?.[1];
}

/**
 * Nettoie les intitulés bruités poussés par certains ATS via Jobillico, du type
 * « Carpenter Foreman Job Details | Aecon » → « Carpenter Foreman ». N'affecte
 * pas un intitulé normal (sans « Job Details » ni suffixe « | … »).
 */
export function cleanJobillicoTitle(t: string): string {
  const s = cleanText(t).replace(/\s*job details\s*(\|.*)?$/i, "").trim();
  return s || cleanText(t);
}

/**
 * Repli : certaines pages employeur (ex. Aecon) n'émettent PAS de JSON-LD
 * `ItemList`. Les postes y sont de simples cartes
 * `<a href="/fr/offre-d-emploi/<slug>/…/<id>">Titre</a>`. On ne retient que les
 * liens de CET employeur (slug) se terminant par un id numérique, pour éviter
 * les sections « emplois similaires » d'autres entreprises.
 */
export function parseEmployerCards(html: string, slug: string): Listed[] {
  const $ = cheerio.load(html);
  const out = new Map<string, Listed>();
  $(`a[href*="/offre-d-emploi/${slug}/"]`).each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const path = href.split("?")[0]!;
    if (!/\/\d{4,}$/.test(path)) return;
    const url = path.startsWith("http") ? path : `https://www.jobillico.com${path}`;
    if (!out.has(url)) {
      out.set(url, { url, name: cleanJobillicoTitle($(el).attr("title") || $(el).text()) });
    }
  });
  return [...out.values()];
}

/** Postes de la page employeur : JSON-LD `ItemList` d'abord, repli cartes HTML. */
function listEmployerPostings(html: string, listUrl: string): Listed[] {
  const viaLd = parseEmployerItemList(html);
  if (viaLd.length > 0) return viaLd;
  const slug = employerSlug(listUrl);
  return slug ? parseEmployerCards(html, slug) : [];
}

export function makeJobillicoEmployerScraper(config: JobillicoEmployerConfig): Scraper {
  return {
    id: config.id,
    parseList(html: string, baseUrl: string): RawJob[] {
      const detail = extractJsonLdJobs(html, config.id, baseUrl);
      if (detail.length > 0) {
        return detail.map((j) => ({ ...j, title: cleanJobillicoTitle(j.title), company: config.company }));
      }
      return listEmployerPostings(html, config.listUrl).map((l) => ({
        sourceId: config.id,
        url: l.url,
        title: l.name || "Poste",
        company: config.company,
        tags: [],
      }));
    },
    async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
      ctx.log(`${config.id} — liste employeur : ${config.listUrl}`);
      let html: string;
      try {
        html = await ctx.fetchHtml(config.listUrl);
      } catch (err) {
        ctx.log(`${config.id} — échec : ${(err as Error).message}`);
        return [];
      }
      const listed = listEmployerPostings(html, config.listUrl);
      ctx.log(`${config.id} — ${listed.length} poste(s) listé(s)`);

      const cap = config.detailCap ?? 40;
      const out: RawJob[] = [];
      let fetched = 0;
      for (const l of listed) {
        const shallow: RawJob = {
          sourceId: config.id,
          url: l.url,
          title: l.name || "Poste",
          company: config.company,
          tags: [],
        };
        if (fetched >= cap) {
          out.push(shallow);
          continue;
        }
        fetched++;
        try {
          const detailHtml = await ctx.fetchHtml(l.url);
          const detail = extractJsonLdJobs(detailHtml, config.id, l.url);
          out.push(
            detail[0]
              ? { ...detail[0], url: l.url, title: cleanJobillicoTitle(detail[0].title), company: config.company }
              : shallow,
          );
        } catch {
          out.push(shallow);
        }
      }
      return out;
    },
  };
}
