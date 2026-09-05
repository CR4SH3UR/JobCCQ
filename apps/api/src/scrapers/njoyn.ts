import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { absolute, cleanText } from "./util.js";

/**
 * Portail **Njoyn** (ATS de CGI, `*.njoyn.com/…/Xweb.asp?page=joblisting`).
 *
 * La page « joblisting » rend un tableau de postes : chaque intitulé est un lien
 * vers la fiche `…&page=jobdetails&…&JobId=<id>`. On repère ces liens (signal
 * fiable, insensible au thème), on déduplique par identifiant de poste, et on
 * lit le lieu dans la cellule voisine (repli : lieu par défaut de l'employeur).
 *
 * ⚠️ Njoyn est souvent derrière une protection anti-robot (captcha Radware) qui
 * bloque les IP de centre de données : la récupération DOIT passer par le proxy
 * sortant (voir infra/README-proxy.md — ajouter `njoyn.com` à SCRAPE_PROXY_HOSTS
 * ou mettre « * »). Si la page renvoyée est le captcha, on n'émet rien **et on
 * ne signale pas d'absence** (pas de purge des offres existantes).
 */
export interface NjoynScraperConfig {
  id: string;
  company: string;
  /** URL « page=joblisting » (de préférence sans jeton de session, plus stable). */
  listUrl: string;
  /** Lieu par défaut (siège) pour les postes sans ville → détection de région. */
  defaultLocation?: string;
}

/** User-Agent navigateur : Njoyn refuse les UA « bot » identifiables. */
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** La réponse est-elle la page de défi anti-robot (Radware) plutôt que la liste ? */
export function isNjoynBlocked(html: string): boolean {
  return /radware|captcha/i.test(html) && !/jobdetails/i.test(html);
}

/** Identifiant stable d'un poste depuis l'URL de sa fiche (sinon l'URL nettoyée). */
function jobKey(url: string): string {
  const m = url.match(/(?:jobdetailid|postingid|reqid|jobid)=([^&]+)/i);
  return (m?.[1] ?? url.replace(/[?#].*$/, "")).toLowerCase();
}

/** Textes de liens à ignorer comme intitulé (boutons « Postuler », « Détails »…). */
const GENERIC_LINK = /^(postuler|apply|appliquer|d[ée]tails?|voir(?:\s+le\s+poste)?|more|en savoir plus|\+|→)$/i;

export function parseNjoyn(
  html: string,
  baseUrl: string,
  id: string,
  company: string,
  defaultLocation?: string,
): RawJob[] {
  if (isNjoynBlocked(html)) return [];
  const $ = cheerio.load(html);
  const byKey = new Map<string, { url: string; title: string; location?: string }>();

  $("a[href]").each((_, el) => {
    const $a = $(el);
    const url = absolute(baseUrl, $a.attr("href") ?? "");
    if (!/[?&]page=jobdetails/i.test(url) && !/jobdetails/i.test(url)) return;
    const text = cleanText($a.text());
    const key = jobKey(url);

    // Lieu : cellule voisine du tableau qui ressemble à « Ville, QC ».
    let location: string | undefined;
    const row = $a.closest("tr");
    if (row.length) {
      const cells = row
        .find("td")
        .toArray()
        .map((td) => cleanText($(td).text()))
        .filter(Boolean);
      location = cells.find(
        (t) => t !== text && t.length <= 40 && /,\s*(?:QC|Qu[ée]bec)\b/i.test(t),
      );
    }

    const isTitle = !!text && !GENERIC_LINK.test(text);
    const cur = byKey.get(key);
    if (!cur) {
      byKey.set(key, { url, title: isTitle ? text : "", location });
    } else {
      if (isTitle && text.length > cur.title.length) cur.title = text;
      if (!cur.location && location) cur.location = location;
      // Préfère l'URL de la fiche (souvent portée par le lien-titre).
      if (isTitle) cur.url = url;
    }
  });

  const jobs: RawJob[] = [];
  for (const v of byKey.values()) {
    if (!v.title) continue;
    jobs.push({
      sourceId: id,
      url: v.url,
      title: v.title,
      company,
      ...(v.location || defaultLocation ? { location: v.location ?? defaultLocation } : {}),
    });
  }
  return jobs;
}

export function makeNjoynScraper(config: NjoynScraperConfig): Scraper {
  return {
    id: config.id,
    parseList: (html, baseUrl) =>
      parseNjoyn(html, baseUrl || config.listUrl, config.id, config.company, config.defaultLocation),
    async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
      ctx.log(`${config.id} — Njoyn joblisting : ${config.listUrl}`);
      let html: string;
      try {
        html = await ctx.fetchHtml(config.listUrl, { userAgent: BROWSER_UA });
      } catch (err) {
        ctx.log(`${config.id} — échec : ${(err as Error).message}`);
        return [];
      }
      // Captcha : ne rien émettre ET ne pas signaler d'absence (pas de purge).
      if (isNjoynBlocked(html)) {
        ctx.log(
          `${config.id} — bloqué (captcha Radware). Route njoyn.com via SCRAPE_PROXY_URL (voir infra/README-proxy.md).`,
        );
        return [];
      }
      const jobs = parseNjoyn(html, config.listUrl, config.id, config.company, config.defaultLocation);
      if (jobs.length === 0 && html.length > 2000) ctx.markNoOpenings?.(false);
      ctx.log(`${config.id} — ${jobs.length} poste(s)`);
      return jobs;
    },
  };
}
