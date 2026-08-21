import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { extractJsonLdJobs } from "./jsonld.js";
import { cleanText, deslugify, mapEmploymentType, slugify } from "./util.js";

/**
 * Fabrique un scraper pour une **page carrières d'entreprise** (employeur) :
 * une seule page liste les postes ouverts. On tente d'abord les données
 * structurées JSON-LD, puis un repli HTML qui cible les liens de fiches de
 * poste. Idéal pour ajouter rapidement un employeur au répertoire.
 *
 * Statut recommandé : `experimental` (les sélecteurs du repli HTML doivent
 * être validés contre le DOM réel de chaque site).
 */
export interface CareersScraperConfig {
  id: string;
  company: string;
  careersUrl: string;
  /**
   * Motif d'URL identifiant une fiche de poste (ex. /\/emploi-/). Si fourni,
   * le repli HTML ne retient que les liens correspondants — plus précis que
   * l'heuristique générique (emploi|poste|carriere|job).
   */
  jobPathPattern?: RegExp;
}

function absolute(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function sameUrl(a: string, b: string): boolean {
  return a.replace(/\/+$/, "") === b.replace(/\/+$/, "");
}

/** Mots-clés qui trahissent un type de poste (donc une carte d'offre). */
const JOB_TYPE_RE =
  /temps\s*plein|temps\s*partiel|permanent|contractuel|contrat|saisonnier|temporaire|\d+\s*h\b|\d+\s*heures|\bstage\b|\bccq\b/i;

/**
 * Repli pour les sites **Wix** : les postes sont rendus dans un
 * `.wixui-repeater`, chaque item portant en général 3 blocs de texte
 * (titre, lieu, type) et un lien vers la fiche. On isole les items qui
 * ressemblent à des offres (présence d'un type de poste) pour éviter les
 * autres répéteurs de la page (avantages, équipe, témoignages…).
 */
function parseWixRepeaters(
  html: string,
  baseUrl: string,
  careersUrl: string,
  id: string,
  company: string,
): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $(".wixui-repeater").each((_, rep) => {
    const $rep = $(rep);
    const inner = $rep.children().first();
    const items = inner.children().length ? inner.children() : $rep.children();

    items.each((_, item) => {
      const $item = $(item);
      const texts = [
        ...new Set(
          $item
            .find("h1,h2,h3,h4,h5,h6")
            .map((_, h) => cleanText($(h).text()))
            .get()
            .filter(Boolean),
        ),
      ];
      // Une offre = un item « titre + lieu + type » (peu de blocs). Un item qui
      // contient une longue liste d'intitulés n'est PAS une offre unique : on le
      // laisse au repli « titres ».
      if (texts.length < 2 || texts.length > 5 || !texts.some((t) => JOB_TYPE_RE.test(t))) return;

      const title = texts[0]!;
      if (title.length < 3 || title.length > 140) return;

      const detail = $item
        .find("a[href]")
        .map((_, a) => $(a).attr("href") || "")
        .get()
        .find((h) => /^https?:\/\//.test(h) && !/facebook|instagram|linkedin\.com|youtube|mailto:|tel:/i.test(h));
      const url = (detail ? absolute(detail.split("#")[0] ?? "", baseUrl) : `${careersUrl}#${slugify(title)}`);
      if (seen.has(url)) return;

      let type: string | undefined;
      let location: string | undefined;
      for (const t of texts.slice(1)) {
        if (!type && JOB_TYPE_RE.test(t)) type = t;
        else if (!location) location = t;
      }

      seen.add(url);
      jobs.push({
        sourceId: id,
        url,
        title,
        company,
        location,
        employmentType: mapEmploymentType(type),
        tags: [],
      });
    });
  });

  return jobs;
}

const NAV_LABELS =
  /^(carrières|carrieres|postuler|postuler maintenant|je postule|postule[rz]?|en savoir plus|en savoir \+|voir|voir l'offre|voir l'emploi|voir ce poste|voir le poste|voir plus|voir tout|voir d[ée]tails?|d[ée]tails?( du poste)?|plus de d[ée]tails|consulter|lire( la suite| plus)?|accueil|contact|nous joindre|nous rejoindre|contactez-nous|rejoignez-nous|joindre l'équipe|emplois|emploi|carrière|english|anglais|fran[çc]ais|home|apply|apply now|view|view job|view details|read more|learn more|more|à propos|a propos|services|blogue?|soumission|équipe|equipe|réalisations|realisations|candidature spontan[ée]e|postulez( ici| maintenant)?)$/i;

/**
 * Débuts de phrase « marketing » : une accroche (« Un emploi de plombier à
 * échelle humaine », « Pourquoi nous rejoindre ») n'est pas un titre de poste.
 */
const MARKETING_PREFIX =
  /^(un |une |notre |nos |nous |pourquoi|rejoign|joins|deviens|devenez|faites|envie|pr[êe]t|viens|es-tu|as-tu|ton |ta |tes |vos |votre |travaille[rz]|construis|b[âa]tis|joignez|candidature spontan[ée]e?)/i;

/** Pathname d'une URL, ou "" si invalide. */
function safePath(u: string): string {
  try {
    return new URL(u).pathname;
  } catch {
    return "";
  }
}

/**
 * Un chemin d'URL ressemble-t-il à une **fiche de poste** ? (mot-clé de section
 * + un slug). Permet de récupérer un titre depuis un lien « En savoir plus »
 * même quand la fiche n'est pas une sous-page directe de la page carrières
 * (ex. carrières = /demandes-emploi/, fiche = /emploi/installateurs/).
 */
const JOB_DETAIL_SEG =
  /(?:^|\/)(?:emplois?|offres?|postes?|carri[eè]res?|jobs?|careers?|opportunit[eé]s?|opportunit(?:y|ies)|vacatures?)\/[^/]+/i;
function looksLikeJobDetail(urlPath: string, careersPath: string): boolean {
  if (!urlPath || urlPath === careersPath) return false;
  const segs = urlPath.split("/").filter(Boolean);
  if (segs.length < 2) return false; // besoin d'un mot-clé + un slug
  const last = segs[segs.length - 1] ?? "";
  if (last.length < 3) return false;
  return JOB_DETAIL_SEG.test(urlPath);
}

function parseHtmlCareers(
  html: string,
  baseUrl: string,
  careersUrl: string,
  id: string,
  company: string,
  jobPathPattern?: RegExp,
): RawJob[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const jobs: RawJob[] = [];

  const careersPath = safePath(careersUrl).replace(/\/+$/, "");

  // Intitulés (h1-h5) indexés par slug : sert à récupérer un libellé propre
  // (accents, apostrophes, ponctuation) quand un lien de fiche n'expose qu'un
  // slug d'URL ou un texte inutilisable (« En savoir plus »).
  const headingByKey = new Map<string, string>();
  const keyOf = (s: string) => slugify(s).replace(/-/g, "");
  $("h1,h2,h3,h4,h5").each((_, h) => {
    const t = cleanText($(h).text());
    if (t.length >= 4 && t.length <= 120) {
      const k = keyOf(t);
      if (k && !headingByKey.has(k)) headingByKey.set(k, t);
    }
  });

  const selector = jobPathPattern
    ? "a[href]"
    : 'a[href*="carriere"], a[href*="emploi"], a[href*="poste"], a[href*="/job"], a[href*="offre"], a[href*="opportunit"]';

  $(selector).each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (jobPathPattern && !jobPathPattern.test(href)) return;
    const url = absolute((href.split("#")[0] ?? "").trim(), baseUrl);
    if (sameUrl(url, careersUrl)) return; // ignore la page index elle-même
    // Clé de déduplication insensible au « / » final : /emplois/foo/ et
    // /emplois/foo (bouton « Voir le poste » vs carte cliquable) = même offre.
    const dedupKey = url.replace(/\/+$/, "");
    if (seen.has(dedupKey)) return;

    let title = ($(el).text() || $(el).attr("title") || "").replace(/\s+/g, " ").trim();
    // Certains sites encodent le poste dans un paramètre d'URL du bouton
    // « Postuler » (ex. ?poste=Ferblantier#contact). On le préfère au texte.
    const qMatch = href.match(/[?&](?:poste|position|job|titre|title|offre)=([^&#]+)/i);
    if (qMatch) {
      const decoded = decodeURIComponent((qMatch[1] ?? "").replace(/\+/g, " ")).trim();
      if (decoded.length >= 3 && decoded.length <= 120) title = decoded;
    }
    const urlPath = safePath(url).replace(/\/+$/, "");
    const isSubPage = !!careersPath && urlPath !== careersPath && urlPath.startsWith(careersPath + "/");
    const isDetail = isSubPage || looksLikeJobDetail(urlPath, careersPath);
    const unusable =
      !title ||
      title.length < 3 ||
      title.length > 120 ||
      NAV_LABELS.test(title) ||
      MARKETING_PREFIX.test(title);
    // L'URL pointe une fiche de poste (/emploi/<slug>/). Un intitulé (h1-h5) de
    // même slug prime : il donne un libellé propre (accents/apostrophes) et
    // évite les textes inutilisables (« Voir le poste ») comme les textes
    // fourre-tout des cartes cliquables (« Titre + 1re ligne de description »).
    const lastSeg = urlPath.split("/").pop() ?? "";
    const heading = isDetail ? headingByKey.get(keyOf(lastSeg)) : undefined;
    if (heading && (unusable || heading.length < title.length)) {
      title = heading;
    } else if (unusable && isDetail) {
      const derived = deslugify(lastSeg).replace(
        /\b(de|du|des|la|le|les|aux?|et|en|sur|pour)\b/gi,
        (w) => w.toLowerCase(),
      );
      if (derived.length >= 4) title = derived;
    }
    // Certaines listes (widgets Jobillico intégrés) collent le lieu au titre
    // sans séparateur (« …aux comptes recevablesSherbrooke, Qc »). On retire un
    // suffixe « Ville, QC » terminal (déclenché seulement s'il finit par , QC).
    title = title
      .replace(
        /([a-zà-ÿ])([A-ZÀ-Ÿ][a-zà-ÿ]+(?:[\s-][A-ZÀ-Ÿ][a-zà-ÿ]+)*,\s*(?:QC|Qc|Québec|Quebec))\s*$/,
        "$1",
      )
      .trim();
    if (!title || title.length < 3 || title.length > 120) return;
    if (NAV_LABELS.test(title) || MARKETING_PREFIX.test(title)) return;

    seen.add(dedupKey);
    jobs.push({ sourceId: id, url, title, company, tags: [] });
  });

  return jobs;
}

/**
 * Mots qui identifient un **titre de poste de la construction** dans un simple
 * intitulé (h2/h3…). Dernier repli pour les petites pages carrières
 * (Wix/WordPress) qui listent les postes en titres, sans données structurées,
 * lien ni type par poste.
 */
// N'inclut que des **noms de métier** (une personne qui exerce). On évite les
// mots de domaine/activité seuls (« Ventilation », « Excavation », « Pavage »,
// « Maintenance ») qui sont surtout des titres de section, et « manager » seul
// (« Google Tag Manager »). Les vrais postes de ces domaines ont un mot de
// métier (« Technicien en ventilation », « Manœuvre en excavation »).
const JOB_TITLE_HINT =
  /op[ée]rateur|man(?:œ|oe)uvre|contrema[iî]tre|chef\s+d['’]?\s*[ée]quipe|chef\s+de\s+chantier|estimateur|charg[ée] de projet|m[ée]canicien|charpentier|menuisier|arpenteur|camionneur|chauffeur|journalier|soudeur|grutier|coffreur|cimentier|ferrailleur|foreur|signaleur|apprenti|[ée]lectricien|plombier|couvreur|poseur|technicien|ing[ée]nieur|superviseur|coordonnateur|adjoint|commis|acheteur|magasinier|conducteur|d[ée]neigement|paveur|briqueteur|ma[çc]on|foreman|dessinateur|tuyauteur|mineur|ferblantier|calorifugeur|monteur|installateur|serrurier|vitrier|peintre|pl[âa]trier|[ée]b[ée]niste|assembleur|directeur|gestionnaire|conseiller|repr[ée]sentant|foreuse|d[ée]bosseleur|carrossier|technician|labou?rer|carpenter|welder|electrician|plumber|operator|apprentice|installer|mechanic|estimator|supervisor|helper|roofer|superintendent|millwright|ironworker|fitter|painter|surveyor|foreperson/i;

/** Suffixe de raison sociale — un « titre » qui finit ainsi est un nom d'entreprise, pas un poste. */
const COMPANY_SUFFIX = /\b(inc|lt[ée]e|ltd|limit[ée]e|senc|enr|corp)\.?$/i;

const SECTION_LABEL =
  /postes?\s+(?:disponibles|ouverts)|nos emplois|offres? d'emploi|postulez|candidature|pourquoi|avantages/i;

/** Repli « titres » : chaque intitulé qui ressemble à un poste devient une offre. */
function parseHeadingJobs(html: string, careersUrl: string, id: string, company: string): RawJob[] {
  const $ = cheerio.load(html);
  const out = new Map<string, RawJob>();
  const base = careersUrl.replace(/\/+$/, "");

  const add = (title: string) => {
    const t = cleanText(title.replace(/^[-–—•*\s]+/, ""));
    if (t.length < 4 || t.length > 110) return;
    // Les qualificatifs entre parenthèses (« (institutionnel et commercial) »,
    // « (jour/soir) », « (H/F) ») ne doivent pas fausser les filtres (« et »,
    // longueur…) : on teste sur une version sans parenthèses, mais on conserve
    // le libellé complet pour l'affichage.
    const probe = t.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim() || t;
    if (!JOB_TITLE_HINT.test(probe) || SECTION_LABEL.test(probe)) return;
    if (COMPANY_SUFFIX.test(probe)) return; // « … inc./ltée » = nom d'entreprise, pas un poste
    if (MARKETING_PREFIX.test(probe)) return; // accroche marketing, pas un poste
    // Rejet des **phrases** (puces de responsabilités « Installer et superviser
    // les systèmes… ») sans écarter les vrais intitulés qui contiennent « et »
    // ou « en » (« Dessinateur en Conception 3D et Mise en Plan »). Un intitulé
    // est un groupe nominal court ; une phrase commence par un verbe d'action ou
    // contient un connecteur, et dépasse souvent 8 mots.
    if (probe.split(/\s+/).length > 8) return;
    if (
      /^(installer|superviser|assurer|effectuer|g[ée]rer|r[ée]aliser|participer|coordonner|planifier|ex[ée]cuter|contr[ôo]ler|veiller|maintenir|pr[ée]parer|d[ée]velopper|concevoir|proc[ée]der|collaborer|respecter|appliquer|utiliser|lire|obtenir|poss[ée]der|d[ée]tenir|avoir|[êe]tre|travailler|prendre|soutien|exp[ée]rience)\b/i.test(
        probe,
      )
    )
      return;
    if (/\b(afin|ainsi|selon|lorsque|puisque|notamment|responsable de)\b/i.test(probe)) return;
    const url = `${base}#${slugify(t)}`;
    if (!out.has(url)) out.set(url, { sourceId: id, url, title: t, company, tags: [] });
  };

  // Intitulés en gras (<strong>/<b>) et titres : listes de postes sans liens.
  $("h1,h2,h3,h4,h5,strong,b").each((_, el) => {
    const raw = cleanText($(el).text());
    if (raw.length < 4) return;
    // Certaines pages listent plusieurs postes dans un même intitulé
    // (« - Contremaître - Charpentier - Manœuvre »). On sépare ces énumérations.
    const parts = raw.split(/\s+[-–—•|]\s+/).filter(Boolean);
    if (parts.length > 1) parts.forEach(add);
    else add(raw);
  });
  // <li> : risqué (puces d'exigences, cartes). On n'accepte qu'un intitulé
  // court et propre (peu de mots, sans chiffres ni marqueurs de phrase FR/EN).
  $("li").each((_, el) => {
    if ($(el).find("li").length) return; // conteneur, pas une feuille
    const raw = cleanText($(el).text());
    if (raw.length < 4 || raw.length > 48) return;
    if (/\d/.test(raw)) return; // dates / quantités (cartes)
    if (raw.split(/\s+/).length > 6) return;
    if (/\b(in|or|and|with|the|of|de la|du)\b/i.test(raw)) return; // exigences EN / phrase
    // Puces d'exigences (« Valid driver's license », « Permis de conduire »,
    // « Minimum 3 années d'expérience ») : ce ne sont pas des postes.
    if (/licen[cs]e|permis|valid|minimum|exp[ée]rience|ann[ée]es?|ability|must|required|driving|driver|assurance|avantages?|b[ée]n[ée]fices?|atout/i.test(raw))
      return;
    add(raw);
  });
  // Accordéons : certains sites listent les postes en <a href="#">Titre</a> (ou
  // ancre de fragment), le clic révélant la description + un bouton « Postuler ».
  // Le texte de l'ancre est alors le titre. On ne prend que les ancres « feuille »
  // (sans titre imbriqué) pour éviter d'avaler une carte entière ; add() filtre.
  $('a[href="#"], a[href^="#"], a:not([href])').each((_, el) => {
    if ($(el).find("h1,h2,h3,h4,h5,li,p").length) return; // conteneur, pas un libellé
    add(cleanText($(el).text()));
  });
  return [...out.values()];
}

export function makeCareersScraper(config: CareersScraperConfig): Scraper {
  return {
    id: config.id,

    parseList(html: string, baseUrl: string): RawJob[] {
      const jsonld = extractJsonLdJobs(html, config.id, baseUrl);
      if (jsonld.length > 0) return jsonld;
      const wix = parseWixRepeaters(html, baseUrl, config.careersUrl, config.id, config.company);
      if (wix.length > 0) return wix;
      // Si la source expose un motif de lien de poste (ex. /emploi-…), on le
      // privilégie (vraies URLs de fiches).
      if (config.jobPathPattern) {
        const links = parseHtmlCareers(
          html,
          baseUrl,
          config.careersUrl,
          config.id,
          config.company,
          config.jobPathPattern,
        );
        if (links.length > 0) return links;
      }
      // Liens de fiches réelles (/emploi/<slug>/, titre récupéré de l'intitulé
      // ou du slug) vs repli « titres » en #fragment. On préfère les vraies
      // URLs dès qu'elles couvrent au moins autant de postes que les titres.
      const links = parseHtmlCareers(html, baseUrl, config.careersUrl, config.id, config.company);
      const heads = parseHeadingJobs(html, config.careersUrl, config.id, config.company);
      if (links.length > 0 && links.length >= heads.length) return links;
      if (heads.length > 0) return heads;
      return links;
    },

    async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
      ctx.log(`${config.id} — page carrières : ${config.careersUrl}`);
      let html: string;
      try {
        html = await ctx.fetchHtml(config.careersUrl);
      } catch (err) {
        ctx.log(`${config.id} — échec : ${(err as Error).message}`);
        return [];
      }
      const jobs = this.parseList!(html, config.careersUrl);
      ctx.log(`${config.id} — ${jobs.length} poste(s) trouvé(s)`);
      return jobs;
    },
  };
}
