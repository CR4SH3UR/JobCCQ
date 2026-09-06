import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * Charles-Auguste Fortier inc. (excavationcaf.ca) — excavation / déneigement.
 *
 * Les offres ne sont pas des fiches structurées : elles vivent dans la section
 * `#carrieres` de la page d'accueil, en **texte libre** sous forme de titres de
 * catégorie `** CATÉGORIE **` suivis (ou non) de sous-postes `-- …`. Ex. :
 *
 *   ** DÉNEIGEMENT **           → catégorie
 *   -- conducteurs de chenillette   → poste
 *   -- opérateurs de niveleuse      → poste
 *   ** SIGNALEUR ROUTIER-CONSTRUCTION **  → poste autonome (aucun « -- »)
 *   ** 3 POSTES DE MÉCANICIEN **    → catégorie
 *   -- engin de chantier            → poste
 *
 * Le scraper générique confondait les en-têtes de catégorie avec des postes
 * (titres « 3 POSTES DE … »), ratait tous les sous-postes `--` et rejetait toute
 * la catégorie « déneigement » (mot de service filtré). Ce parseur sur mesure
 * reconstruit chaque poste : `Catégorie — Sous-poste` (ou `Catégorie` seule pour
 * un poste autonome). Postuler = courriel (emploi@cafortier.com) → pas d'URL par
 * poste ; on ancre chaque offre sur `#<slug>` pour un identifiant stable.
 */
const ID = "charles-auguste-fortier-inc-caf";
const COMPANY = "Charles-Auguste Fortier inc.";
const BASE = "https://excavationcaf.ca/";

/** « ENGIN DE CHANTIER » / « conducteurs de chenillette » → casse de phrase. */
function sentenceCase(s: string): string {
  const t = cleanText(s).toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/** Nettoie un en-tête `** … **` : retire les marqueurs et le préfixe « N POSTES DE ». */
function cleanCategory(raw: string): string {
  const label = cleanText(raw)
    .replace(/^\**\s*|\s*\**$/g, "") // marqueurs * résiduels
    .replace(/\s*:\s*$/, "")
    .replace(/^\d+\s*/, "") // compte éventuel (« 3 POSTES DE … »)
    .replace(/^postes?\s+de\s+/i, ""); // « POSTE(S) DE … »
  return sentenceCase(label);
}

/**
 * Parse la section `#carrieres` (texte libre) en offres.
 * `parseList` pur → testable hors-ligne avec une fixture.
 */
export function parseCafortier(html: string, baseUrl = BASE): RawJob[] {
  const $ = cheerio.load(html);
  const section = $("#carrieres");
  let inner = section.length ? section.html() ?? "" : html;
  // Les retours (`<br>`) et fins de bloc portent la structure des lignes.
  inner = inner
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(h[1-6]|p|div|li|tr|font)>/gi, "\n");
  const text = cheerio.load(inner).root().text();

  const lines = text.split(/\n+/).map((l) => cleanText(l)).filter(Boolean);

  // On commence après « EMPLOIS DISPONIBLES: » pour ignorer l'intro.
  const start = lines.findIndex((l) => /emplois?\s+disponibles/i.test(l));
  const body = start >= 0 ? lines.slice(start + 1) : lines;

  // Regroupe : chaque en-tête `** … **` ouvre une catégorie ; les `-- …` sont
  // ses sous-postes. Une catégorie sans sous-poste = un poste autonome.
  const groups: Array<{ category: string; subs: string[] }> = [];
  let cur: { category: string; subs: string[] } | null = null;
  for (const line of body) {
    const head = line.match(/^\*{2,}\s*(.+?)\s*\*{2,}$/);
    if (head) {
      cur = { category: cleanCategory(head[1]!), subs: [] };
      if (cur.category) groups.push(cur);
      continue;
    }
    const sub = line.match(/^-{2,}\s*(.+)$/);
    if (sub && cur) {
      const s = sentenceCase(sub[1]!);
      if (s) cur.subs.push(s);
    }
  }

  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  const push = (title: string, seasonal: boolean, tag: string) => {
    const t = cleanText(title);
    if (!t) return;
    let slug = slugify(t);
    let url = `${baseUrl}#${slug}`;
    for (let n = 2; seen.has(url); n++) url = `${baseUrl}#${slug}-${n}`;
    seen.add(url);
    jobs.push({
      sourceId: ID,
      url,
      title: t,
      company: COMPANY,
      employmentType: seasonal ? "saisonnier" : undefined,
      tags: tag ? [tag] : [],
    });
  };

  for (const g of groups) {
    // Le déneigement est saisonnier (hiver) au Québec.
    const seasonal = /d[ée]neigement/i.test(g.category);
    if (g.subs.length === 0) {
      push(g.category, seasonal, "");
    } else {
      for (const sub of g.subs) push(`${g.category} — ${sub}`, seasonal, g.category);
    }
  }

  return jobs;
}

export const cafortierScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseCafortier(html, baseUrl.replace(/#.*$/, "") || BASE);
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    let html: string;
    try {
      html = await ctx.fetchHtml(BASE);
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseCafortier(html, BASE);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    return jobs;
  },
};
