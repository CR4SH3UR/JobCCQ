import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText } from "./util.js";

/**
 * Guay inc. — grutier / levage / transport (guay.com/carriere/).
 *
 * La page carrières n'affiche que la **première page** (6 offres) ; les suivantes
 * sont chargées en **AJAX** par le thème `gruesguay` (assets/js/career.js) via
 * `admin-ajax.php` (action `ajax_getPositions`). Le repli HTML générique rate
 * donc les 2/3 des postes. Ce scraper sur mesure rejoue la pagination AJAX pour
 * récupérer **toutes** les offres.
 *
 * Contrat AJAX (POST form-urlencoded) :
 *   action=ajax_getPositions&offset=<n>&way=<filters|next>&search=&filters_areas=[]
 * La réponse est un fragment HTML de cartes `.card-position` + un bloc
 * `.pagination .buttons[data-offset]` avec un bouton `.-next` (désactivé sur la
 * dernière page). On repart de ce `data-offset` avec `way=next` jusqu'au bout.
 */
const AJAX_URL = "https://guay.com/wp-admin/admin-ajax.php";
const ID = "guay-com";
const COMPANY = "Guay inc.";

// admin-ajax de WordPress ne répond qu'au POST ici (le GET renvoie une liste
// vide) ; on présente un UA navigateur classique par politesse.
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function employmentTypeOf(text: string): RawJob["employmentType"] {
  const t = text.toLowerCase();
  if (/temps\s*partiel/.test(t)) return "temps-partiel";
  if (/temps\s*plein/.test(t)) return "temps-plein";
  if (/saisonn/.test(t)) return "saisonnier";
  if (/stage|stagiaire/.test(t)) return "stage";
  if (/contrat/.test(t)) return "contrat";
  return undefined;
}

/**
 * Parse un fragment de résultats Guay (cartes `.card-position`).
 * Chaque carte : `h3` = titre, 1er `<p>` = ville, 2e `<p>` = type/horaire,
 * `a[href]` = URL de l'offre (`/positions/<slug>/`).
 */
export function parseGuay(html: string, id = ID, company = COMPANY): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $(".card-position").each((_, el) => {
    const $c = $(el);
    const title = cleanText($c.find("h3").first().text());
    const href = $c.find("a[href]").first().attr("href");
    if (!title || !href) return;
    const url = href.split("#")[0]!.split("?")[0]!;
    if (!/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.add(url);

    // Champs directs de `.content` : <p>ville</p><p>type | horaire</p>. On reste
    // sur les enfants directs pour exclure le <p>« En apprendre plus »</p> du bouton.
    const ps = $c
      .find(".content")
      .children("p")
      .map((_i, p) => cleanText($(p).text()))
      .get()
      .filter(Boolean);
    const location = ps[0] || undefined;

    jobs.push({
      sourceId: id,
      url,
      title,
      company,
      location,
      employmentType: employmentTypeOf(`${ps.join(" ")} ${title}`),
      tags: [],
    });
  });

  return jobs;
}

/** Bloc de pagination : offset courant + s'il reste une page suivante. */
function readPager(html: string): { offset: number; hasNext: boolean } {
  const $ = cheerio.load(html);
  const $btns = $(".pagination .buttons").first();
  const offset = Number($btns.attr("data-offset") ?? "0") || 0;
  const $next = $btns.find(".-next").first();
  // `.-next` porte l'attribut `disabled` sur la dernière page.
  const hasNext = $next.length > 0 && $next.attr("disabled") === undefined;
  return { offset, hasNext };
}

async function loadPage(way: string, offset: number): Promise<string> {
  const body = new URLSearchParams({
    action: "ajax_getPositions",
    offset: String(offset),
    way,
    search: "",
    filters_areas: "[]",
  }).toString();
  const res = await fetch(AJAX_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "text/html,*/*;q=0.8",
      "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.6",
      "User-Agent": BROWSER_UA,
      "X-Requested-With": "XMLHttpRequest",
    },
    body,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export const guayScraper: Scraper = {
  id: ID,
  parseList(html: string): RawJob[] {
    return parseGuay(html);
  },
  async scrape(params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    const maxPages = Math.max(1, params.maxPages ?? 20);
    const all = new Map<string, RawJob>();
    let way = "filters"; // 1er appel : charge la page 1
    let offset = 0;

    for (let page = 1; page <= maxPages; page++) {
      let html: string;
      try {
        html = await loadPage(way, offset);
      } catch (err) {
        ctx.log(`${ID} — arrêt page ${page} : ${(err as Error).message}`);
        break;
      }
      const batch = parseGuay(html);
      let fresh = 0;
      for (const job of batch) if (!all.has(job.url)) (all.set(job.url, job), fresh++);
      ctx.log(`${ID} — page ${page} (offset ${offset}) : ${batch.length} offre(s), ${fresh} nouvelle(s)`);

      const { offset: pageOffset, hasNext } = readPager(html);
      if (!hasNext) break; // dernière page (bouton « Suivant » désactivé)
      if (fresh === 0) break; // sécurité anti-boucle si la pagination stagne
      offset = pageOffset; // on repart du data-offset renvoyé, avec way=next
      way = "next";
    }

    const jobs = [...all.values()];
    if (jobs.length === 0) ctx.markNoOpenings?.();
    ctx.log(`${ID} — ${jobs.length} poste(s) au total`);
    return jobs;
  },
};
