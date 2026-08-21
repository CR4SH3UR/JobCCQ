import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";

/**
 * Aménagement Grenon (amenagementgrenon.com) — site **Next.js** dont la page
 * carrières charge les postes en JavaScript depuis une API JSON interne
 * (`/api/jobs`). Le repli HTML générique ne voit donc rien (« Chargement des
 * postes… »). On lit directement l'API : tableau d'objets
 * `{ name, slug, description, published }`. La fiche d'un poste est
 * `…/carriere/<slug>`.
 */
const ID = "amenagementgrenon-com";
const HOMEPAGE = "https://amenagementgrenon.com";
const API_URL = `${HOMEPAGE}/api/jobs`;
const COMPANY = "Aménagement Grenon";

interface GrenonJob {
  name?: string;
  title?: string;
  slug?: string;
  description?: string;
  published?: boolean;
}

/** Extrait le texte d'intro de la description (champ JSON encodé en chaîne). */
function descriptionText(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    const d = JSON.parse(raw) as { text?: unknown };
    if (typeof d.text === "string" && d.text.trim()) return d.text.trim().slice(0, 600);
  } catch {
    /* description non-JSON : on ignore */
  }
  return undefined;
}

export const amenagementGrenonScraper: Scraper = {
  id: ID,

  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — API JSON : ${API_URL}`);
    let raw: string;
    try {
      raw = await ctx.fetchHtml(API_URL);
    } catch (err) {
      ctx.log(`${ID} — échec : ${(err as Error).message}`);
      return [];
    }
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      ctx.log(`${ID} — réponse /api/jobs non-JSON`);
      return [];
    }
    const list = Array.isArray(data) ? (data as GrenonJob[]) : [];
    const jobs: RawJob[] = [];
    const seen = new Set<string>();
    for (const j of list) {
      if (j.published === false) continue; // brouillons / postes retirés
      const title = (j.name ?? j.title ?? "").replace(/\s+/g, " ").trim();
      const slug = (j.slug ?? "").trim();
      if (!title || !slug) continue;
      const url = `${HOMEPAGE}/carriere/${slug}`;
      if (seen.has(url)) continue;
      seen.add(url);
      jobs.push({
        sourceId: ID,
        url,
        title,
        company: COMPANY,
        description: descriptionText(j.description),
        tags: [],
      });
    }
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    return jobs;
  },
};
