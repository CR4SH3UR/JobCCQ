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
  /** Lieu lu depuis la carte (repli HTML), pour les fiches non détaillées. */
  location?: string;
}

/** Slug de l'employeur dans une URL de fiche (…/offre-d-emploi/<slug>/…). */
function offerEmployerSlug(url: string): string | undefined {
  return url.match(/\/offre-d?-?emploi\/([^/]+)\//i)?.[1];
}

/**
 * Extrait les postes de l'ItemList (URL + titre).
 *
 * `ownSlug` (le slug de l'employeur scrapé) filtre les fiches pour ne garder que
 * celles de CET employeur : certaines pages Jobillico affichent aussi les offres
 * d'une entreprise sœur partageant le compte recruteur (ex. « Action Progex »
 * liste les postes d'« Action Estimation »). Sans ce filtre, l'offre serait
 * rattachée au mauvais employeur (l'id d'offre venant de l'URL, c'est le dernier
 * scrape qui gagne). Omettre `ownSlug` conserve l'ancien comportement.
 */
export function parseEmployerItemList(html: string, ownSlug?: string): Listed[] {
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
        // Écarte les fiches d'un AUTRE employeur cross-listées sur la page.
        if (ownSlug && offerEmployerSlug(href) !== ownSlug) continue;
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
 * Lieu manifestement HORS Québec : JobCCQ est un board québécois, on écarte les
 * postes d'une autre province (fréquent chez les employeurs pancanadiens, ex.
 * Aecon : 444/479 hors QC). Un lieu vide/ambigu est CONSERVÉ (on ne jette pas un
 * poste québécois mal formaté).
 */
export function isOutsideQuebec(location?: string): boolean {
  if (!location) return false;
  if (/\bqu[eé]bec\b/i.test(location) || /\bqc\b/i.test(location)) return false;
  if (/\b(ON|AB|BC|MB|SK|NS|NB|PE|NL|YT|NT|NU)\b/.test(location)) return true;
  return /\b(ontario|alberta|british columbia|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|yukon|nunavut|colombie-britannique|nouveau-brunswick|nouvelle-[ée]cosse|terre-neuve|[îi]le-du-prince)\b/i.test(
    location,
  );
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
    if (out.has(url)) return;
    // Lieu = le <p> de la carte sans classe « mb0 » (société) ni « date ».
    const card = $(el).closest(".card__content, li, .card");
    let location = "";
    card.find("p").each((_i, p) => {
      if (location) return;
      const cls = $(p).attr("class") || "";
      if (/\bmb0\b/.test(cls) || /\bdate\b/.test(cls)) return;
      location = cleanText($(p).text());
    });
    out.set(url, {
      url,
      name: cleanJobillicoTitle($(el).attr("title") || $(el).text()),
      location: location || undefined,
    });
  });
  return [...out.values()];
}

/** Postes de la page employeur : JSON-LD `ItemList` d'abord, repli cartes HTML. */
function listEmployerPostings(html: string, listUrl: string): Listed[] {
  const slug = employerSlug(listUrl);
  const viaLd = parseEmployerItemList(html, slug);
  if (viaLd.length > 0) return viaLd;
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

      // Pagination : Jobillico limite l'affichage (souvent 25/page). On demande
      // 100/page via `iPerPage` et on parcourt `ipage` jusqu'à ne plus rien
      // récupérer de nouveau (certains employeurs, ex. Aecon, ont des centaines
      // de postes). Garde-fou `MAX_PAGES` pour éviter une boucle infinie.
      const PAGE_SIZE = 100;
      const MAX_PAGES = 30;
      const pageUrl = (n: number) => {
        const sep = config.listUrl.includes("?") ? "&" : "?";
        return `${config.listUrl}${sep}iPerPage=${PAGE_SIZE}&ipage=${n}`;
      };

      const seen = new Set<string>();
      const listed: Listed[] = [];
      for (let n = 1; n <= MAX_PAGES; n++) {
        let pageHtml: string;
        try {
          pageHtml = await ctx.fetchHtml(pageUrl(n));
        } catch (err) {
          if (n === 1) {
            ctx.log(`${config.id} — échec : ${(err as Error).message}`);
            return [];
          }
          break; // une page ultérieure échoue → on garde les postes déjà lus
        }
        const pageListed = listEmployerPostings(pageHtml, config.listUrl);
        let added = 0;
        for (const l of pageListed) {
          if (seen.has(l.url)) continue;
          seen.add(l.url);
          listed.push(l);
          added++;
        }
        if (added === 0) break; // plus aucun nouveau poste → fin de la liste
      }
      // Filtre Québec : on écarte les postes clairement hors QC (le lieu de la
      // carte suffit pour la plupart), AVANT de récupérer les fiches détaillées.
      const before = listed.length;
      const quebec = listed.filter((l) => !isOutsideQuebec(l.location));
      if (before !== quebec.length) {
        ctx.log(`${config.id} — ${before} listé(s), ${before - quebec.length} hors Québec écarté(s)`);
      } else {
        ctx.log(`${config.id} — ${quebec.length} poste(s) listé(s)`);
      }

      const cap = config.detailCap ?? 40;
      const out: RawJob[] = [];
      let fetched = 0;
      for (const l of quebec) {
        const shallow: RawJob = {
          sourceId: config.id,
          url: l.url,
          title: l.name || "Poste",
          company: config.company,
          location: l.location,
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
              ? {
                  ...detail[0],
                  url: l.url,
                  // Titre de la liste (bien capitalisé) prioritaire sur celui,
                  // parfois en minuscules, du JSON-LD de la fiche.
                  title: l.name || cleanJobillicoTitle(detail[0].title),
                  company: config.company,
                  location: detail[0].location || l.location,
                }
              : shallow,
          );
        } catch {
          out.push(shallow);
        }
      }
      // 2e passe : le lieu vient parfois de la fiche détaillée (path ItemList).
      return out.filter((j) => !isOutsideQuebec(j.location));
    },
  };
}
