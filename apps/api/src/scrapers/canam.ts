import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText } from "./util.js";

/**
 * Canam (canam.com/offres-demplois/) — fabricant de structures d'acier / ponts.
 *
 * Deux frictions pour le scraper générique :
 *  1. le site renvoie **403** aux UA « bot » (WordPress + WP-Rocket) — il faut un
 *     UA navigateur ;
 *  2. la liste est **paginée** via `?pages=2|3|4` (16 offres/page, ~63 au total),
 *     donc seule la 1re page était lue, et le titre y absorbait la ville
 *     (« Peintre industriel Trois-Rivières »).
 *
 * Ce scraper sur mesure présente un UA navigateur, parcourt toutes les pages
 * (nombre détecté depuis les liens `?pages=`), et sépare titre / ville à partir
 * des cartes `.c-card-job` (titre = `.c-card-job__title span`, ville = étiquette
 * `.c-btn--tag`, URL = `/emploi/<slug>/`).
 */
const ID = "canam-com";
const COMPANY = "Canam";
const LIST_URL = "https://www.canam.com/offres-demplois/";
const HARD_CAP = 20; // garde-fou anti-boucle (le site n'a que ~4 pages)

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Parse une page de résultats : cartes `.c-card-job` + nombre total de pages. */
export function parseCanam(html: string): { jobs: RawJob[]; maxPage: number } {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $("a.c-card-job").each((_, el) => {
    const $a = $(el);
    const href = $a.attr("href");
    if (!href) return;
    const url = href.split("#")[0]!.split("?")[0]!;
    if (!/\/emploi\//.test(url) || seen.has(url)) return;

    // Titre : le libellé de `.c-card-job__title` sans l'icône (flèche).
    const $title = $a.find(".c-card-job__title").first().clone();
    $title.find(".c-card-job__icon, svg").remove();
    const title = cleanText($title.text());
    if (!title) return;

    // Ville(s) : étiquette(s) `.c-btn--tag` (texte sans l'icône).
    const locs: string[] = [];
    $a.find(".c-btn--tag").each((_i, t) => {
      const $t = $(t).clone();
      $t.find("svg").remove();
      const s = cleanText($t.text());
      if (s) locs.push(s);
    });

    seen.add(url);
    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      location: locs.join(", ") || undefined,
      tags: [],
    });
  });

  // Nombre de pages : plus grand `?pages=N` référencé dans la pagination.
  let maxPage = 1;
  $('a[href*="pages="]').each((_, el) => {
    const m = ($(el).attr("href") ?? "").match(/[?&]pages=(\d+)/);
    if (m) maxPage = Math.max(maxPage, Number(m[1]));
  });

  return { jobs, maxPage };
}

export const canamScraper: Scraper = {
  id: ID,
  parseList(html: string): RawJob[] {
    return parseCanam(html).jobs;
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    const all = new Map<string, RawJob>();
    let maxPage = 1;

    for (let page = 1; page <= Math.min(maxPage, HARD_CAP); page++) {
      const url = page === 1 ? LIST_URL : `${LIST_URL}?pages=${page}`;
      let html: string;
      try {
        html = await ctx.fetchHtml(url, { userAgent: BROWSER_UA });
      } catch (err) {
        ctx.log(`${ID} — arrêt page ${page} : ${(err as Error).message}`);
        break;
      }
      const { jobs, maxPage: mp } = parseCanam(html);
      if (page === 1) maxPage = Math.max(mp, 1); // total de pages appris en p1
      let fresh = 0;
      for (const j of jobs) if (!all.has(j.url)) (all.set(j.url, j), fresh++);
      ctx.log(`${ID} — page ${page}/${maxPage} : ${jobs.length} offre(s), ${fresh} nouvelle(s)`);
      if (page > 1 && fresh === 0) break; // sécurité : plus rien de neuf
    }

    const list = [...all.values()];
    if (list.length === 0) ctx.markNoOpenings?.();
    ctx.log(`${ID} — ${list.length} poste(s) au total`);
    return list;
  },
};

/**
 * Doublon de découverte : Canam figure aussi sous l'id `groupecanam-com` (même
 * page carrières, autre licence RBQ). Pour ne pas afficher Canam deux fois, ce
 * doublon est routé vers un scraper vide à **purge explicite** — les offres
 * réelles vivent sous `canam-com`.
 */
export const groupeCanamDuplicateScraper: Scraper = {
  id: "groupecanam-com",
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log("groupecanam-com — doublon de canam-com : aucune offre distincte (purge)");
    ctx.markNoOpenings?.(true); // purge, quelle que soit la taille
    return [];
  },
};
