import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText } from "./util.js";

/**
 * Scraper dédié à Atelier En Hauteur (WordPress). La page /carrière affiche
 * l'offre complète en ligne (beaucoup de sous-titres : « Ce que nous
 * recherchons », « OFFRE D'EMPLOI : … »), si bien que le repli générique
 * captait un mauvais intitulé. On suit plutôt les fiches
 * `/carrieres/<slug>/` et on prend le vrai titre dans leur `<h1>`.
 */
const CAREERS = "https://atelierenhauteur.ca/carriere/";
const COMPANY = "Atelier En Hauteur inc.";

function decode(s: string): string {
  return s
    .replace(/&#0?39;|&#8217;|&rsquo;/gi, "’")
    .replace(/&amp;/gi, "&")
    .replace(/&#?\w+;/g, " ");
}

/** Nettoie l'intitulé : retire les balises, décode, enlève le préfixe « Offre d'emploi : ». */
function cleanJobTitle(raw: string): string {
  const t = cleanText(decode(raw.replace(/<[^>]+>/g, " ")));
  return t.replace(/^\s*offre\s+d['’\s]?emploi\s*:?\s*/i, "").trim();
}

export const atelierEnHauteurScraper: Scraper = {
  id: "atelierenhauteur-ca",
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`atelierenhauteur-ca — page carrières : ${CAREERS}`);
    let list: string;
    try {
      list = await ctx.fetchHtml(CAREERS);
    } catch (err) {
      ctx.log(`atelierenhauteur-ca — échec : ${(err as Error).message}`);
      return [];
    }
    const urls = [
      ...new Set(
        [...list.matchAll(/href="(https:\/\/atelierenhauteur\.ca\/carrieres\/[^"#]+\/)"/gi)].map(
          (m) => m[1]!,
        ),
      ),
    ];
    const out: RawJob[] = [];
    for (const url of urls) {
      let title = "";
      try {
        const detail = await ctx.fetchHtml(url);
        title = cleanJobTitle(detail.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
      } catch {
        /* fiche inaccessible : on retombe sur le slug */
      }
      if (!title) {
        const slug = url.replace(/\/$/, "").split("/").pop() ?? "";
        title = cleanJobTitle(slug.replace(/-/g, " "));
      }
      if (!title) continue;
      out.push({ sourceId: "atelierenhauteur-ca", url, title, company: COMPANY, location: "Montréal", tags: [] });
    }
    ctx.log(`atelierenhauteur-ca — ${out.length} poste(s) trouvé(s)`);
    if (out.length === 0) ctx.markNoOpenings?.(false);
    return out;
  },
};
