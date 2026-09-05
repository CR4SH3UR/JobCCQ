import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { cleanText, slugify } from "./util.js";

/**
 * Brunelle Électrique inc. — brunelleelectrique.com
 *
 * La page carrières GoDaddy affiche les postes sous un titre « CARRIÈRES »
 * sous forme de liens `<a>` pointant vers des formulaires externes
 * (subscribepage.io, bit.ly) ou, parfois, vers des pages internes ou des PDF.
 * Chaque lien est son propre titre de poste (ex. « CHARGÉ(E) DE PROJETS »).
 *
 * Le parseur repère la section carrières, collecte les liens qui suivent et
 * construit une URL absolue. Si le lien est vide ou relatif, on retombe sur
 * la careersUrl avec un fragment stable basé sur le titre.
 */
const ID = "brunelleelectrique-com";
const COMPANY = "Brunelle Électrique inc.";
const CAREERS_URL = "https://brunelleelectrique.com/carrieres";

/** Mots-clés de navigation / contenu à ignorer comme titre de poste. */
const IGNORED_TITLES = /^(?:carrières?|accueil|services?|service|sécurité|qualité|blogue|soumission|nous joindre|contact|télécharger le pdf|voir descriptions?|projets & réalisations)$/i;

/** Mots-clés qui aident à reconnaître un titre de poste parmi les liens. */
const JOB_KEYWORDS = /(?:^|[^a-zà-ÿ0-9])(électricien|électricienne|apprenti|compagnon|contremaître|chargé|chargée|projet|projeteur|estimateur|technicien|ingénieur|commis|manoeuvre|opérateur|mécanicien|camion)(?:$|[^a-zà-ÿ0-9])/i;

function makeUrl(href: string | undefined, baseUrl: string, title: string): string | undefined {
  const raw = (href ?? "").trim();
  if (!raw) {
    return `${baseUrl}#${slugify(title)}`;
  }
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return `${baseUrl}#${slugify(title)}`;
  }
}

/** Parse la page carrières de Brunelle Électrique. */
export function parseBrunelleElectrique(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  // Repère le titre de section « CARRIÈRES » / « POSTES DISPONIBLES ».
  const $heading = $("h1, h2, h3, h4, h5, h6").filter((_, el) => {
    const text = cleanText($(el).text()).toLowerCase();
    return text.includes("carrière") || text.includes("poste");
  });

  // Collecte les liens situés dans les éléments frères suivant le heading
  // jusqu'au prochain titre de section (h2/h3) ou fin de section.
  let $links = $("<a></a>"); // empty cheerio object
  if ($heading.length) {
    const $siblings = $heading.first().nextUntil("h2, h3, section, [data-ux=Section]");
    $links = $siblings.find("a").add($siblings.filter("a"));
  }
  // Fallback si la structure est trop compacte : tous les liens du body.
  if (!$links.length) {
    $links = $("body a");
  }

  $links.each((_, el) => {
    const $el = $(el);
    const title = cleanText($el.text());
    if (!title || title.length < 3 || IGNORED_TITLES.test(title)) return;

    // On ne garde que les liens qui ressemblent à des postes (mot-clé) ou
    // qui pointent vers un domaine externe (bit.ly, subscribepage, etc.).
    const href = $el.attr("href") ?? "";
    const isExternal = /^https?:\/\//i.test(href.trim());
    if (!isExternal && !JOB_KEYWORDS.test(title)) return;

    const url = makeUrl(href, baseUrl, title);
    if (!url || seen.has(url)) return;

    seen.add(url);
    jobs.push({
      sourceId: ID,
      url,
      title,
      company: COMPANY,
      description: undefined,
      tags: [],
    });
  });

  return jobs;
}

export const brunelleElectriqueScraper: Scraper = {
  id: ID,
  parseList(html: string, baseUrl: string): RawJob[] {
    return parseBrunelleElectrique(html, baseUrl || CAREERS_URL);
  },
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL);
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = parseBrunelleElectrique(html, CAREERS_URL);
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();
    return jobs;
  },
};
