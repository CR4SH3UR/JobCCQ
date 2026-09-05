import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { makeCareersScraper } from "./careers.js";

/**
 * Baulne (mécanique du bâtiment / CVAC) — page carrières « accordéon ».
 *
 * Le repli générique fonctionne mais la page **décrit chaque poste deux fois**
 * (une version « Bureau de Montréal – … » + la fiche détaillée, parfois avec une
 * graphie différente) → doublons (« trop d'offres »). On déduplique sur une clé
 * normalisée (préfixe « Bureau de … – » retiré, complément entre parenthèses
 * ignoré) et on garde l'intitulé le plus complet, sans le préfixe de bureau.
 */
const ID = "baulne-ca";
const COMPANY = "Baulne";
const CAREERS = "https://www.baulne.ca/carriere-mecanique-du-batiment/";
const LOCATION = "Montréal, QC";

const base = makeCareersScraper({ id: ID, company: COMPANY, careersUrl: CAREERS });

/** Retire un préfixe « Bureau de <ville> – » d'un intitulé. */
function stripBureau(title: string): string {
  return title.replace(/^\s*bureau\s+de\s+[^–\-:]+[–-]\s*/i, "").trim();
}

/** Clé de dédup : sans accents/casse, préfixe bureau retiré, complément « (…) » ignoré. */
function dedupKey(title: string): string {
  return stripBureau(title)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function dedupeBaulne(jobs: RawJob[]): RawJob[] {
  const best = new Map<string, RawJob>();
  for (const j of jobs) {
    const key = dedupKey(j.title);
    if (!key) continue;
    const title = stripBureau(j.title);
    const cur = best.get(key);
    // Garde l'intitulé le plus complet (souvent la version accentuée).
    if (!cur || title.length > cur.title.length) {
      best.set(key, { ...j, title, location: j.location ?? LOCATION });
    }
  }
  return [...best.values()];
}

export const baulneScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => dedupeBaulne(base.parseList!(html, baseUrl || CAREERS)),
  async scrape(params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    return dedupeBaulne(await base.scrape(params, ctx));
  },
};
