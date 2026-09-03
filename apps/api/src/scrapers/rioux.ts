import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * Scraper dédié à Groupe Rioux (rioux.ca/carrieres) — dont fait partie l'employeur
 * « Habitat Construction Matane ». La page est un site Squarespace où chaque poste
 * est un bloc JSON encodé en entités HTML :
 *
 *   { "title": "Charpentier.ère-Menuisier.ère | Habitat",
 *     "description": "<p>MATANE</p>",              ← en fait le LIEU
 *     "button": { "buttonText": "APPLIQUEZ | INDEED",
 *                 "buttonLink": "https://…indeed.com/viewjob?jk=…" } }
 *
 * Le repli générique captait le **bouton** (« APPLIQUEZ | INDEED ») comme titre et
 * le lien Indeed comme URL — d'où des offres parasites. Ce parseur isole le vrai
 * intitulé (heading du bloc), déduit le lieu de la description et pointe l'URL vers
 * la candidature Indeed.
 */
const CAREERS = "https://www.rioux.ca/carrieres";
const COMPANY = "Habitat Construction Matane (1986) Inc.";

/** Décode les entités HTML qui enrobent le JSON Squarespace de la page. */
function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Nettoie l'intitulé : retire le suffixe de division « | HMC / Habitat / Rioux ». */
function cleanJobTitle(t: string): string {
  return cleanText(t.replace(/\s*\|\s*(HMC|Habitat|Rioux)\s*$/i, ""));
}

/** Corrige/valide l'URL de candidature (une fiche a un « /https://… » erroné). */
function fixUrl(link: string): string | undefined {
  const url = link.replace(/^\/+(?=https?:)/i, "").trim();
  return /^https?:\/\//i.test(url) ? url : undefined;
}

export const riouxScraper: Scraper = {
  id: "rioux-ca",
  parseList(html: string): RawJob[] {
    const decoded = decodeEntities(html);
    // Bloc de poste : titre, puis description, puis un bouton (buttonText/buttonLink).
    const re =
      /"title":\s*"([^"]+)"\s*,\s*"description":\s*"((?:[^"\\]|\\.)*)"\s*,\s*"button":\s*\{\s*"buttonText":\s*"([^"]*)"\s*,\s*"buttonLink":\s*"([^"]*)"/g;
    const out = new Map<string, RawJob>();
    for (const m of decoded.matchAll(re)) {
      const [, rawTitle, rawDesc, btnText, btnLink] = m;
      // Uniquement les vrais postes (bouton de candidature Indeed) : écarte les
      // blocs marketing (« Rêver grand. ») et la candidature spontanée.
      if (!/indeed/i.test(`${btnText} ${btnLink}`)) continue;
      const title = cleanJobTitle(rawTitle!);
      if (!title || /candidature\s+spontan/i.test(title)) continue;

      // La « description » du bloc contient le lieu (ex. « MATANE », « MATANE |
      // CARLETON | MARIA », « PROVINCE DU QUÉBEC »).
      const place = cleanText(decodeEntities(rawDesc!).replace(/<[^>]+>/g, " ")).split("|")[0]!.trim();
      const location = place && !/province/i.test(place) ? place : undefined;

      let url = fixUrl(decodeEntities(btnLink!)) ?? `${CAREERS}#${slugify(title)}`;
      // Deux postes peuvent pointer vers la même page Indeed (fiche entreprise) :
      // on garantit une URL unique (donc un id stable distinct par poste).
      if (out.has(url)) url = `${CAREERS}#${slugify(title)}`;

      out.set(url, {
        sourceId: "rioux-ca",
        url,
        title,
        company: COMPANY,
        ...(location ? { location } : {}),
        tags: [],
      });
    }
    return [...out.values()];
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`rioux-ca — page carrières : ${CAREERS}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS);
    } catch (err) {
      ctx.log(`rioux-ca — échec : ${(err as Error).message}`);
      return [];
    }
    const jobs = this.parseList!(html, CAREERS);
    ctx.log(`rioux-ca — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.(false);
    return jobs;
  },
};
