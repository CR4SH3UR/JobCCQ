import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText, slugify } from "./util.js";

/**
 * Cas par Cas (casparcas.ca) — ébénisterie / menuiserie.
 *
 * Page carrière construite avec Elementor : chaque poste est un titre `<h1>`
 * (l'éditeur réutilise h1 pour chaque carte) dans la section « Postes
 * disponibles ». Les postes avec une fiche dédiée exposent un bouton
 * « En savoir plus » vers `/emploi-<slug>/` ; les autres n'ont pas d'URL propre
 * (on fabrique alors une ancre slugifiée). On délimite la zone des postes entre
 * l'intitulé « Postes disponibles » et la section de clôture (« Faites le
 * premier pas… »), en excluant les candidatures spontanées.
 */
const ID = "casparcas-ca";
const COMPANY = "Cas par Cas";
const CAREERS_URL = "https://www.casparcas.ca/carriere/";

const START = /postes?\s+disponibles/i;
const STOP = /premier\s+pas/i; // section CTA de clôture
const SKIP = /spontan|candidat/i; // « Candidatures spontanées »

function isJobTitle(t: string): boolean {
  return !!t && t.length >= 3 && t.length <= 120 && !t.endsWith("?") && !SKIP.test(t);
}

/**
 * Parse la page carrière et retourne une offre par poste de la section.
 *
 * On parcourt titres et liens `/emploi-…/` en ordre du document : chaque lien
 * de fiche se rattache au dernier titre de poste rencontré (le bouton « En
 * savoir plus » suit son titre dans la carte). Un poste sans lien garde une
 * ancre slugifiée. On évite ainsi de rattacher à un poste le lien d'un poste
 * voisin (ce qu'un parcours d'ancêtres ferait sur des cartes imbriquées).
 */
export function parseCasParCas(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const byTitle = new Map<string, RawJob>();
  const base = baseUrl.split("#")[0]!;

  let inSection = false;
  let current: RawJob | null = null;
  let currentHasLink = false;

  $("h1, h2, h3, a[href*='/emploi-']").each((_, el) => {
    const tag = (el.tagName || "").toLowerCase();

    if (tag === "a") {
      if (!inSection || !current || currentHasLink) return;
      const href = ($(el).attr("href") ?? "").trim();
      if (!href) return;
      current.url = absolute(base, href);
      currentHasLink = true;
      return;
    }

    // Titre / intitulé de section.
    const title = cleanText($(el).text());
    if (!inSection) {
      if (START.test(title)) inSection = true;
      return;
    }
    if (STOP.test(title)) {
      inSection = false;
      current = null;
      return;
    }
    if (!isJobTitle(title)) {
      current = null; // ex. « Candidatures spontanées » : aucun lien ne s'y rattache
      return;
    }

    const existing = byTitle.get(title);
    if (existing) {
      current = existing;
      currentHasLink = /\/emploi-/.test(existing.url);
      return;
    }
    const job: RawJob = { sourceId: ID, url: `${base}#${slugify(title)}`, title, company: COMPANY, tags: [] };
    byTitle.set(title, job);
    jobs.push(job);
    current = job;
    currentHasLink = false;
  });

  return jobs;
}

export const casParCasScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseCasParCas(html, baseUrl || CAREERS_URL),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrière : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL);
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseCasParCas(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
