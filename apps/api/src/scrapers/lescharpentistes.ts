import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText } from "./util.js";

/**
 * Construction Les Charpentistes (lescharpentistes.ca) — charpente / menuiserie.
 *
 * Site Squarespace : les offres sont de simples **liens** dans un bloc de texte,
 * sous le titre « Actuellement », vers des pages au slug **sans mot-clé**
 * (`/charpentierrecherche`, `/cheffedeladministration`,
 * `/estimateur-dessinateur-charpente-bois`). Le scraper générique les ignorait
 * (slugs non reconnus comme fiches d'emploi) → 0 offre.
 *
 * Ce parseur cible le bloc `.sqs-html-content` contenant « Actuellement » et en
 * extrait chaque lien comme une offre (les autres blocs — nav, pied de page —
 * n'ont pas ce marqueur et sont donc ignorés).
 */
const ID = "lescharpentistes-ca";
const COMPANY = "Construction Les Charpentistes inc.";
const CAREERS_URL = "https://www.lescharpentistes.ca/carrieres";

// Squarespace renvoie 403 aux UA « bot » → on présente un UA navigateur.
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Slugs de navigation à écarter s'ils apparaissaient dans le bloc.
const NAV_SLUGS = /\/(commercial|residentiel|r[ée]sidentiel|sur-mesure|carrieres|carri[èe]res|contact|a-propos|about|services?)\/?$/i;

/** Parse le bloc « Actuellement » et renvoie une offre par lien. */
export function parseCharpentistes(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $(".sqs-html-content").each((_, block) => {
    const $b = $(block);
    // Seul le bloc listant les postes ouverts porte le marqueur « Actuellement ».
    if (!/actuellement|postes?\s+(?:disponibles?|ouverts?|à\s+combler)/i.test($b.text())) return;

    $b.find("a[href]").each((_i, el) => {
      const $a = $(el);
      const href = ($a.attr("href") ?? "").trim();
      if (!href || /^(mailto:|tel:|#)/i.test(href)) return;

      let url: string;
      try {
        url = new URL(href, baseUrl).toString().split("#")[0]!;
      } catch {
        return;
      }
      if (NAV_SLUGS.test(url) || seen.has(url)) return;

      // Titre = texte du lien, sans l'accroche « … recherché(e)(s) » finale.
      const title = cleanText($a.text()).replace(/\s+recherch[ée]e?s?\s*$/i, "").trim();
      if (!title || title.length < 3) return;

      seen.add(url);
      jobs.push({ sourceId: ID, url, title, company: COMPANY, tags: [] });
    });
  });

  return jobs;
}

export const lescharpentistesScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseCharpentistes(html, baseUrl || CAREERS_URL);
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL, { userAgent: BROWSER_UA });
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseCharpentistes(html, CAREERS_URL);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    return jobs;
  },
};
