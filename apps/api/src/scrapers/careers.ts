import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
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

/** Retire la chaîne de requête et le fragment (`?…`, `#…`) d'une URL. */
function stripQuery(u: string): string {
  return u.replace(/[?#].*$/, "");
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
  /^(carrières|carrieres|postuler|postuler maintenant|postuler ici|postulez ici|description|description du poste|description de poste|description de l'emploi|je postule|postule[rz]?|en savoir plus|en savoir \+|voir|voir l'offre|voir l'emploi|voir ce poste|voir le poste|voir les postes?( disponibles?)?|voir (tous|toutes) les (postes?|emplois?|offres?)( disponibles?)?|voir les offres?( d'emploi)?|voir les d[ée]tails?( du poste)?|voir plus|voir tout|voir d[ée]tails?|d[ée]tails?( du poste)?|plus de d[ée]tails|consulter|lire( la suite| plus)?|accueil|contact|nous joindre|nous rejoindre|contactez-nous|rejoignez-nous|joindre l'équipe|emplois|emploi|postes?|carrière|english|anglais|fran[çc]ais|home|apply|apply now|view|view job|view details|read more|learn more|more|à propos|a propos|services|blogue?|soumission|équipe|equipe|réalisations|realisations|site|plan du site|travaux|projets|candidature spontan[ée]e|postulez( ici| maintenant)?|jobillico|indeed|linkedin|workday|glassdoor|neuvoo|monster|talentu?p|retour( [àa] la liste| aux (offres|emplois|postes))?|[«»‹›<>→←\s]*(?:pr[ée]c[ée]dent|suivant)[«»‹›<>→←\s]*|postes?( actuellement)? (disponibles?|ouverts?|[àa] (combler|pourvoir)|en recrutement( continu)?)|(postes? en )?recrutement continu|postes? [àa] pourvoir|partager|partage|partagez|share|[ÉéEe]quipements?|produits?|nos produits|emplois?\s+(?:temps\s+plein|temps\s+partiel|t[ée]l[ée]travail|[ée]tudiants?|permanents?|saisonniers?|occasionnels?|contractuels?)|guide\s+carri[èe]re|eoe|eeo|faq|eng)$/i;

/**
 * Débuts de phrase « marketing » : une accroche (« Un emploi de plombier à
 * échelle humaine », « Pourquoi nous rejoindre ») n'est pas un titre de poste.
 */
const MARKETING_PREFIX =
  /^(un |une |notre |nos |nous |pourquoi|rejoign|joins|deviens|devenez|faites|envie|pr[êe]t|viens|es-tu|as-tu|ton |ta |tes |vos |votre |vous |tu ne|[àa] la recherche|travaille[rz]|construis|b[âa]tis|joignez|d[ée]couvr(ir|e|ez|ons)|candidature spontan[ée]e?|postuler (pour|à|au|aux|en|comme)|postule[rz] (pour|à|au|aux)|appliquer (pour|sur|à)|apply (for|to|now)|voir (tout|tous|toutes|nos)\b|zones? (de|du|d['’])|c[âa]bles? (pour|de|d['’])|connecteurs? (pour|de|d['’])|pour (parler|nous|en savoir|prendre|obtenir|discuter|contacter|planifier|r[ée]server)|rejoins|tu |offrez|restez|abonnez|click here|start your|je d[ée]sire|je veux)/i;

/**
 * Bouton d'action collé à la fin d'un intitulé de carte (« Représentant au
 * service à la clientèle **Voir le poste** ») : on le retire pour garder le
 * titre propre, quel que soit le chemin d'extraction.
 */
const TRAILING_CTA =
  /\s+(voir (le |l['’]|ce )?(poste|offre|emploi|d[ée]tails?)|voir (plus|d[ée]tails?|les)|voir l['’]offre( d['’]emploi)?|d[ée]tails? du poste|consulter le poste|postuler( maintenant| ici)?|postuler|appliquer|en savoir (plus|\+)|plus de d[ée]tails|d[ée]tails|apply( now)?|read more|learn more|lire la suite)\s*$/i;

/**
 * Étiquette « Offre d'emploi – … » collée en tête d'un intitulé de carte
 * (fréquent sur les pages WordPress : le titre de la fiche est « Offre d'emploi
 * – Technicien en géomatique »). On la retire pour ne garder que le métier.
 * Exige un séparateur (– — : - |) après l'étiquette → ne touche pas « Emploi
 * étudiant » ni « Offre spéciale ».
 */
const LEADING_JOB_LABEL = /^\s*offres?\s+d['’]emplois?\s*[–—:|-]\s*/i;

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
/**
 * Slug de fiche **préfixé** par un mot-clé emploi (ex. /portfolio/emploi-charge-de-projet,
 * /nos-postes/poste-soudeur) : ici le mot-clé fait partie du slug final, pas d'un
 * segment séparé — fréquent sur les CPT WordPress (/portfolio/emploi-…).
 */
const KEYWORD_JOB_SLUG = /^(?:emplois?|offres?|postes?|jobs?|carri[eè]res?|opportunit[eé]s?)[-_].{2,}/i;
function looksLikeJobDetail(urlPath: string, careersPath: string): boolean {
  if (!urlPath || urlPath === careersPath) return false;
  const segs = urlPath.split("/").filter(Boolean);
  const last = segs[segs.length - 1] ?? "";
  if (last.length < 3) return false;
  if (KEYWORD_JOB_SLUG.test(last)) return true; // slug préfixé mot-clé (parent quelconque)
  if (segs.length < 2) return false; // sinon : un segment mot-clé + un slug
  return JOB_DETAIL_SEG.test(urlPath);
}

/**
 * Intitulé (h1-h6) le plus proche en **remontant les ancêtres** d'un lien.
 * Sert à récupérer le vrai titre d'une carte de poste quand le texte du lien
 * est un libellé générique (« Voir les détails du poste ») et que le slug de
 * l'URL ne correspond pas à l'intitulé (accents, « en », abréviations). On
 * s'arrête au premier ancêtre contenant un intitulé (la carte du poste) et on
 * garde le plus proche du lien.
 */
function nearestHeading($: cheerio.CheerioAPI, el: AnyNode): string {
  let $node = $(el);
  for (let i = 0; i < 5; i++) {
    const $p = $node.parent();
    if (!$p.length || $p.is("body")) break;
    let picked = "";
    $p.find("h1,h2,h3,h4,h5,h6").each((_, h) => {
      const t = cleanText($(h).text());
      if (t.length >= 3 && t.length <= 120) picked = t; // garde le dernier valide (le plus proche du lien)
    });
    if (picked) return picked;
    $node = $p;
  }
  return "";
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
    // Liens non-navigants : un mailto « carrieres@… » matche a[href*="carriere"]
    // et donnerait une « offre » = adresse courriel (ex. Les Charpentistes).
    if (/^(mailto:|tel:|javascript:|sms:)/i.test(href.trim())) return;
    if (jobPathPattern && !jobPathPattern.test(href)) return;
    const url = absolute((href.split("#")[0] ?? "").trim(), baseUrl);
    if (sameUrl(url, careersUrl)) return; // ignore la page index elle-même
    if (/candidature[-_]?spontan|spontane[eé]?[-_/]?$/i.test(url)) return; // candidature spontanée ≠ poste
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
      // Repli 1 : l'intitulé le plus proche dans la carte du poste (le slug
      // d'URL ne correspond pas toujours au titre affiché). Repli 2 : le slug.
      const near = nearestHeading($, el);
      if (near && !NAV_LABELS.test(near) && !MARKETING_PREFIX.test(near)) {
        title = near;
      } else {
        // Retire un préfixe mot-clé du slug (emploi-…, poste-…) avant de le rendre
        // lisible, sinon le titre garde « Emploi … ».
        const cleanSlug = lastSeg.replace(
          /^(?:emplois?|offres?|postes?|jobs?|carri[eè]res?|opportunit[eé]s?)[-_]/i,
          "",
        );
        const derived = deslugify(cleanSlug).replace(
          /\b(de|du|des|la|le|les|aux?|et|en|sur|pour)\b/gi,
          (w) => w.toLowerCase(),
        );
        if (derived.length >= 4) title = derived;
      }
    } else if (unusable) {
      // Lien de candidature externe (ATS : « Jobillico », « Postuler sur
      // Indeed »…) : l'URL n'est pas une fiche reconnue (autre domaine), mais
      // la carte contient l'intitulé réel — on le récupère du titre le plus
      // proche. Sans intitulé exploitable, le titre reste inutilisable et
      // l'offre est écartée plus bas (mieux que d'afficher « Jobillico »).
      const near = nearestHeading($, el);
      if (near && !NAV_LABELS.test(near) && !MARKETING_PREFIX.test(near)) title = near;
    }
    // Titre = URL brute (lien Jobillico intégré sans texte d'ancre exploitable) :
    // on récupère l'intitulé voisin, sinon on déduit le libellé du slug de l'URL
    // Jobillico (/offre-d-emploi/<entreprise>/<slug>/<id>).
    if (/^https?:\/\//i.test(title)) {
      const near = nearestHeading($, el);
      if (near && !NAV_LABELS.test(near) && !MARKETING_PREFIX.test(near)) {
        title = near;
      } else {
        const jm = title.match(/jobillico\.com\/(?:[a-z]{2}\/)?offre-d-emploi\/[^/]+\/([^/?#]+)/i);
        title = jm ? deslugify(jm[1]!) : "";
      }
    }
    // Titre très long = souvent tout le texte d'une carte (titre + lieu + type +
    // statut collés, sans séparateur). Si la carte porte un intitulé (h1-h6) plus
    // court et valable, on le préfère au texte fourre-tout.
    if (title.length > 90) {
      const near = nearestHeading($, el);
      if (near && near.length < title.length && !NAV_LABELS.test(near) && !MARKETING_PREFIX.test(near)) {
        title = near;
      }
    }
    // Certaines listes (widgets Jobillico intégrés) collent le lieu au titre
    // sans séparateur (« …aux comptes recevablesSherbrooke, Qc »). On retire un
    // suffixe « Ville, QC » terminal (déclenché seulement s'il finit par , QC).
    title = title
      .replace(LEADING_JOB_LABEL, "")
      .replace(TRAILING_CTA, "")
      .replace(
        /([a-zà-ÿ])([A-ZÀ-Ÿ][a-zà-ÿ]+(?:[\s-][A-ZÀ-Ÿ][a-zà-ÿ]+)*,\s*(?:QC|Qc|Québec|Quebec))\s*$/,
        "$1",
      )
      .trim();
    if (!title || title.length < 3 || title.length > 120) return;
    if (NAV_LABELS.test(title) || MARKETING_PREFIX.test(title)) return;
    if (/[!?]\s*$/.test(title)) return; // phrase interro/exclamative = accroche marketing, pas un poste
    if (/poste\s+combl[ée]|poste\s+pourvu|position filled/i.test(title)) return; // poste déjà comblé
    if (SERVICE_LED.test(title)) return; // « Déneigement de… » = service, pas un poste
    if (/^[«»‹›\s]*actualiser\b/i.test(title)) return; // lien de pagination « Actualiser »

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
  /op[ée]rateur|man(?:œ|oe)uvre|contrema[iî]tre|chef\s+d['’]?\s*[ée]quipe|chef\s+de\s+chantier|estimateur|charg[ée] de projet|m[ée]canicien|charpentier|menuisier|arpenteur|camionneur|chauffeur|journalier|soudeur|grutier|coffreur|cimentier|ferrailleur|foreur|signaleur|apprenti|compagnon|stagiaire|[ée]lectricien|plombier|couvreur|poseur|technicien|ing[ée]nieur|superviseur|surintendant|coordonnateur|contr[ôo]leur|adjoint|agent|commis|acheteur|magasinier|conducteur|r[ée]partiteur|d[ée]neigement|paveur|briqueteur|ma[çc]on(?!nerie)|foreman|dessinateur|designer|cuisiniste|tuyauteur|mineur|ferblantier|frigoriste|chauffagiste|calorifugeur|monteur|instal{2,3}ateur|serrurier|vitrier|peintre|pl[âa]trier|[ée]b[ée]niste(?!rie)|assembleur|directeur|gestionnaire|conseiller|repr[ée]sentant|foreuse|d[ée]bosseleur|carrossier|technician|labou?rer|carpenter|welder|electrician|plumber|operator|apprentice|internship|trainee|installer|mechanic|estimator|supervisor|helper|roofer|superintendent|millwright|ironworker|fitter|painter|surveyor|foreperson/i;

/** Suffixe de raison sociale — un « titre » qui finit ainsi est un nom d'entreprise, pas un poste. */
const COMPANY_SUFFIX = /\b(inc|lt[ée]e|ltd|limit[ée]e|senc|enr|corp)\.?$/i;

const SECTION_LABEL =
  /postes?\s+(?:disponibles|ouverts)|nos emplois|offres? d'emploi|postulez|candidature|pourquoi|avantages/i;

/**
 * Mot de **service/activité** seul (« Déneigement », « Excavation », « Aménagement
 * paysager »…) : c'est une prestation de l'entreprise affichée en vitrine, pas
 * une offre. Un vrai poste porte un mot de métier (« Opérateur de déneigement »,
 * « Manœuvre en excavation ») et ne matche donc pas ce motif « exact ».
 */
const SERVICE_ONLY =
  /^(d[ée]neigement|excavation|am[ée]nagement(\s+paysager)?|pavage|ventilation|terrassement|paysagement|maintenance|entretien(\s+(d['’]espaces?\s+verts?|paysager|m[ée]nager))?|toiture|charpente|ma[çc]onnerie|plomberie|[ée]lectricit[ée]|r[ée]novation|construction)(\s+(m[ée]canique|manuel(?:le)?|commerciale?|r[ée]sidentiell?e?|industrielle?)e?)?$/i;

/**
 * Phrase de **service** menée par un mot d'activité (« Déneigement de voies
 * publiques », « Réparation et modifications mineures », « Rénovation de
 * cuisines ») : c'est une prestation, pas un poste. Un vrai intitulé commence
 * par un mot de métier (« Opérateur de déneigement »), jamais par l'activité
 * seule suivie d'un connecteur.
 */
const SERVICE_LED =
  /^(d[ée]neigement|excavation|pavage|terrassement|paysagement|am[ée]nagement|entretien|r[ée]novation|toiture|ma[çc]onnerie|plomberie|[ée]lectricit[ée]|ventilation|r[ée]paration|d[ée]molition|forage|remorquage|d[ée]bosselage|nettoyage|installation)\s+(?:de|des|du|d['’]|et|aux?|pour)\b/i;

/**
 * La page déclare-t-elle explicitement **aucun poste ouvert** ? (« Désolé, il
 * n'y a aucune offre en ce moment », « no current openings »…). Sur ces pages,
 * le repli « titres » capte à tort les métiers listés en vitrine (« Opérateur
 * de pelle », « Soudeur »… = les types de postes de l'entreprise, pas des
 * offres actuelles). On l'utilise pour **désactiver ce repli** — sans toucher
 * aux vraies fiches liées ni au JSON-LD.
 */
function pageDeclaresNoOpenings(html: string): boolean {
  const text = cheerio.load(html)("body").text().replace(/\s+/g, " ");
  return (
    /\baucune?\s+(?:offre|poste|position|opportunit[ée])s?(?:\s+d['’]emploi)?\s+(?:disponible|ouvert|vacant|en ce moment|actuellement|pr[ée]sentement|pour (?:le|l['’]instant|ce) moment|[àa] combler|[àa] afficher|n['’]est)/i.test(
      text,
    ) ||
    /(?:il n['’]y a|nous n['’]avons|n['’]avons)\s+(?:actuellement\s+|pr[ée]sentement\s+)?(?:aucune?\s+(?:offre|poste|position|emploi)|pas d['’](?:offre|poste|emploi))/i.test(
      text,
    ) ||
    // Vitrine de métiers « à titre indicatif » / « postes qui pourraient être
    // demandés selon les besoins » : ce sont les types de postes de l'entreprise,
    // pas des offres ouvertes actuellement.
    /postes?\s+(?:qui\s+)?(?:pourrai(?:en)?t|peuvent|pourront|seraient)\s+[êe]tre\s+(?:demand|combl|requis|ouvert|pourvu|recherch)/i.test(
      text,
    ) ||
    /\bno\s+(?:current\s+|open\s+)?(?:job\s+)?(?:positions?|openings?|vacancies)\s+(?:available|open|at (?:this|the) (?:time|moment)|currently)/i.test(
      text,
    ) ||
    /there are (?:currently )?no (?:open )?(?:positions|jobs|openings|vacancies)/i.test(text)
  );
}

/**
 * Sections d'une **fiche de poste** (description, non des offres). Une puce
 * listée sous « Avantages » / « Responsabilités » / « Exigences »… est du
 * contenu descriptif, jamais un intitulé de poste — même si elle contient un
 * mot de métier (« Contremaîtres accessibles et à l'écoute » sous « Avantages »).
 */
const DETAIL_SECTION =
  /^(responsabilit|exigence|avantage|description|profil|condition|t[âa]che|comp[ée]tence|qualification|qualit[ée]|ce que|pourquoi|nous offrons|au quotidien|r[ôo]le|mandat|sommaire|aper[çc]u|habilet|aptitude|prérequis|pr[ée]requis|nous recherchons)/i;

/** La puce est-elle sous une section de description (et non une liste d'offres) ? */
function underDetailSection($: cheerio.CheerioAPI, el: AnyNode): boolean {
  let $node = $(el);
  for (let depth = 0; depth < 6; depth++) {
    let $sib = $node.prev();
    while ($sib.length) {
      const $h = $sib.is("h1,h2,h3,h4,h5,h6,strong,b")
        ? $sib
        : $sib.find("h1,h2,h3,h4,h5,h6").last();
      if ($h.length) {
        const t = cleanText($h.first().text());
        if (t) return DETAIL_SECTION.test(t);
      }
      $sib = $sib.prev();
    }
    const $p = $node.parent();
    if (!$p.length || $p.is("body")) break;
    $node = $p;
  }
  return false;
}

/** Repli « titres » : chaque intitulé qui ressemble à un poste devient une offre. */
function parseHeadingJobs(html: string, careersUrl: string, id: string, company: string): RawJob[] {
  const $ = cheerio.load(html);
  const out = new Map<string, RawJob>();
  // On retire un éventuel #fragment de l'URL carrières (ex. « …/#carrieres ») avant
  // d'y accoler le slug du poste, sinon on obtient une URL à double « # ».
  const base = careersUrl.replace(/#.*$/, "").replace(/\/+$/, "");

  const add = (title: string, href?: string) => {
    const t = cleanText(title.replace(/^[-–—•*\s]+/, "").replace(/[\s*•·]+$/, ""))
      .replace(LEADING_JOB_LABEL, "")
      .replace(TRAILING_CTA, "")
      .trim();
    if (t.length < 4 || t.length > 110) return;
    if (/[\w.+-]+@[\w.-]+\.\w{2,}/.test(t)) return; // adresse courriel, pas un poste
    // Trombinoscope d'équipe : « Prénom Nom | Fonction » (membre de l'équipe)
    // n'est pas une offre, même si la fonction ressemble à un poste. Gère les
    // prénoms composés (« Marie-Claude Dubé | … »).
    if (/^[A-ZÀ-Ÿ][A-Za-zÀ-ÿ.'’-]+\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ.'’-]+\s*\|/.test(t)) return;
    // Étiquette de champ dans une fiche (« Métier : Cuisiniste », « Type :
    // Temps plein », « Horaire : … ») : ce n'est pas un intitulé de poste.
    if (/^(m[ée]tier|type|horaire|statut|salaire|lieu|d[ée]partement|cat[ée]gorie|secteur|division)\s*:/i.test(t))
      return;
    // Les qualificatifs entre parenthèses (« (institutionnel et commercial) »,
    // « (jour/soir) », « (H/F) ») ne doivent pas fausser les filtres (« et »,
    // longueur…) : on teste sur une version sans parenthèses, mais on conserve
    // le libellé complet pour l'affichage.
    const probe = t.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim() || t;
    if (!JOB_TITLE_HINT.test(probe) || SECTION_LABEL.test(probe)) return;
    if (COMPANY_SUFFIX.test(probe)) return; // « … inc./ltée » = nom d'entreprise, pas un poste
    if (MARKETING_PREFIX.test(probe)) return; // accroche marketing, pas un poste
    if (SERVICE_ONLY.test(probe)) return; // « Déneigement », « Excavation »… = service, pas un poste
    if (SERVICE_LED.test(probe)) return; // « Déneigement de voies publiques »… = service, pas un poste
    if (/^[«»‹›\s]*actualiser\b/i.test(t)) return; // « Actualiser la page » = lien de pagination
    if (/\b[A-Z][A-Z0-9]*_[A-Z0-9]/.test(t)) return; // code produit/SKU (« CMMB_AS »), pas un poste
    // Rejet des **phrases** (puces de responsabilités « Installer et superviser
    // les systèmes… ») sans écarter les vrais intitulés qui contiennent « et »
    // ou « en » (« Dessinateur en Conception 3D et Mise en Plan »). Un intitulé
    // est un groupe nominal court ; une phrase commence par un verbe d'action ou
    // contient un connecteur, et dépasse souvent 8 mots.
    // Compte les mots « réels » : on ignore les tirets isolés d'un intitulé
    // « Poste - Niveau - Lieu » (« - »), qui gonfleraient le total sans en être.
    if (probe.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ0-9]/.test(w)).length > 8) return;
    if (
      /^(installer|superviser|assurer|effectuer|g[ée]rer|r[ée]aliser|participer|coordonner|planifier|ex[ée]cuter|contr[ôo]ler|veiller|maintenir|pr[ée]parer|d[ée]velopper|concevoir|proc[ée]der|collaborer|respecter|appliquer|utiliser|lire|obtenir|poss[ée]der|d[ée]tenir|avoir|[êe]tre|travailler|prendre|soutien|exp[ée]rience|accueillir|accompagner)\b/i.test(
        probe,
      )
    )
      return;
    if (/\b(afin|ainsi|selon|lorsque|puisque|notamment|responsable de)\b/i.test(probe)) return;
    // Phrase de recrutement (« … sont recherchés », « nous recherchons … ») ou
    // phrase complète terminée par une ponctuation de fin : pas un intitulé.
    if (/\b(recherch(?:e|é|è|ez|ons|ent|ait)s?|recrutons|embauchons|cherchons)\b/i.test(probe)) return;
    if (/[.!?]$/.test(t) && probe.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]/.test(w)).length >= 3)
      return;
    if (/[!?]$/.test(t)) return; // interro/exclamatif (accroche/CTA), jamais un intitulé
    if (/poste\s+combl[ée]|poste\s+pourvu/i.test(probe)) return; // poste déjà comblé
    const url = href || `${base}#${slugify(t)}`;
    if (!out.has(url)) out.set(url, { sourceId: id, url, title: t, company, tags: [] });
  };

  // Intitulés en gras (<strong>/<b>) et titres : listes de postes sans liens.
  $("h1,h2,h3,h4,h5,strong,b").each((_, el) => {
    const raw = cleanText($(el).text());
    if (raw.length < 4) return;
    // Certaines pages listent plusieurs postes dans un même intitulé
    // (« Contremaître - Charpentier - Manœuvre »). On ne découpe QUE si CHAQUE
    // segment ressemble à un métier. Sinon l'intitulé est un seul poste suivi
    // d'un niveau/lieu (« Frigoriste - Compagnon ou apprenti - Rive-Sud de
    // Montréal ») : le découper le réduirait à des fragments (« Compagnon ou
    // apprenti »), donc on garde l'intitulé entier.
    const parts = raw.split(/\s+[-–—•|/]\s+/).filter(Boolean);
    const looksLikeTrade = (s: string) =>
      JOB_TITLE_HINT.test(s.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim());
    if (parts.length > 1 && parts.every(looksLikeTrade)) parts.forEach((p) => add(p));
    else add(raw);
  });
  // Titres d'accordéon / onglets Elementor (fréquent sur WordPress : les postes
  // sont dépliables et leur intitulé vit dans un <div>/<span> de classe dédiée,
  // pas dans un h1-h5). add() filtre sur les mots de métier → pas les FAQ.
  $(
    ".e-n-accordion-item-title-text, .elementor-accordion-title, .elementor-tab-title, .e-n-tab-title-text",
  ).each((_, el) => {
    const raw = cleanText($(el).text());
    if (raw.length >= 4) add(raw);
  });
  // <li> : risqué (puces d'exigences, cartes). On n'accepte qu'un intitulé
  // court et propre (peu de mots, sans chiffres ni marqueurs de phrase FR/EN).
  $("li").each((_, el) => {
    const full = cleanText($(el).text());
    // Titre = texte DIRECT de la puce (avant un bloc de description <p>/<div>/
    // sous-liste) ; sinon le texte complet (titre + description) est trop long.
    // Ex. AXCO : « Mécanicien de machinerie lourde : <ul><li>Effectuer…</li></ul> ».
    const lead = cleanText($(el).clone().children().remove().end().text()).replace(/\s*:\s*$/, "");
    const nested = $(el).find("li").length > 0;
    // Puce conteneur (sous-liste) SANS texte propre = structure de menu → on
    // saute ; avec texte propre = le titre est ce texte (la sous-liste = ses tâches).
    if (nested && lead.length < 4) return;
    const raw = lead.length >= 4 && (nested || lead.length < full.length) ? lead : full;
    if (raw.length < 4 || raw.length > 48) return;
    // Chiffres de date / quantité / prix (cartes), mais on garde « Chauffeur
    // classe 1 », « Opérateur type 2 » (un simple chiffre de niveau).
    if (/\b(19|20)\d\d\b|\d+\s*(ans|ann[ée]es|heures?|jours?|semaines?|km|\$|%|,\d)|\d{3,}/i.test(raw))
      return;
    if (raw.split(/\s+/).length > 6) return;
    if (/\b(in|or|and|with|the|of|de la|du)\b/i.test(raw)) return; // exigences EN / phrase
    // Puces d'exigences (« Valid driver's license », « Permis de conduire »,
    // « Minimum 3 années d'expérience ») : ce ne sont pas des postes.
    if (/licen[cs]e|permis|valid|minimum|exp[ée]rience|ann[ée]es?|ability|must|required|driving|driver|assurance|avantages?|b[ée]n[ée]fices?|atout|connaissances?|ma[îi]trise|comp[ée]tences?|aptitudes?|habilet[ée]s?/i.test(raw))
      return;
    if (underDetailSection($, el)) return; // puce d'une section de description
    add(raw);
  });
  // Fiches de poste en lien : accordéon <a href="#">Titre</a> (le clic révèle la
  // description), ou lien vers un **document** de poste (PDF/Word), fréquent sur
  // les petites pages carrières (ex. RCL : <a href="…technicien-cableur.pdf">
  // Technicien câbleur</a>). Le texte de l'ancre est le titre ; on garde l'URL
  // réelle (le PDF) si elle est exploitable. On exclut menus/pieds de page et
  // les ancres conteneurs ; add() filtre sur les mots de métier.
  $(
    'a[href="#"], a[href^="#"], a:not([href]), a[href$=".pdf"], a[href$=".doc"], a[href$=".docx"], a[href*="/document"], a[href*="/_media"]',
  ).each((_, el) => {
    if ($(el).closest("nav,header,footer").length) return; // pas la navigation
    if ($(el).find("h1,h2,h3,h4,h5,li,p").length) return; // conteneur, pas un libellé
    const href = ($(el).attr("href") || "").trim();
    let url: string | undefined;
    if (href && !href.startsWith("#") && !/^(javascript:|mailto:|tel:)/i.test(href)) {
      const abs = absolute(href.split("#")[0] ?? "", careersUrl);
      if (!sameUrl(abs, careersUrl)) url = abs;
    }
    add(cleanText($(el).text()), url);
  });
  return [...out.values()];
}

/**
 * Gabarit ATS « jobs-listing » (ex. glowinthecloud.com, utilisé par plusieurs
 * employeurs). Les postes sont dans `<ul class="jobs-listing"><li>` avec un lien
 * `/{entreprise}/{id}?l=fr` — dont l'URL ne contient AUCUN mot-clé (emploi,
 * poste…), donc le repli « liens » générique les rate. On lit la liste
 * directement : le lien porte le titre, un `<span>` voisin le lieu.
 */
function parseJobsListing(
  html: string,
  careersUrl: string,
  id: string,
  company: string,
): RawJob[] {
  const $ = cheerio.load(html);
  const out = new Map<string, RawJob>();
  $(".jobs-listing li").each((_, li) => {
    const $li = $(li);
    if ($li.find("ul.jobs-listing li").length) return; // <li> conteneur, pas une feuille
    let title = "";
    let href = "";
    $li.find("a[href]").each((_, a) => {
      if (title) return;
      const t = cleanText($(a).text());
      if (t.length >= 4 && t.length <= 120 && !NAV_LABELS.test(t) && !MARKETING_PREFIX.test(t)) {
        title = t;
        href = ($(a).attr("href") || "").trim();
      }
    });
    if (!title || !href || href.startsWith("#")) return;
    const url = absolute(href.split("#")[0] ?? "", careersUrl);
    if (sameUrl(url, careersUrl)) return;
    // Lieu : un <span> voisin (hors du lien-titre) au texte court et sans chiffre.
    let location: string | undefined;
    $li.find("span").each((_, s) => {
      if (location) return;
      if ($(s).closest("a").length) return; // le span DANS le lien = le titre
      const t = cleanText($(s).text());
      if (t && t !== title && t.length >= 2 && t.length <= 40 && !/\d/.test(t)) location = t;
    });
    if (!out.has(url)) out.set(url, { sourceId: id, url, title, company, location, tags: [] });
  });
  return [...out.values()];
}

/**
 * Page = **une seule fiche de poste** ? (URL /emploi/ menant à un poste précis,
 * avec sections « Description du poste / Responsabilités / Exigences / Avantages »
 * et UN seul intitulé de métier en titre). Sur ces pages, les puces de
 * description contiennent des mots de métier (« … contremaîtres accessibles »,
 * « compagnons et apprentis recherchés ») que le repli « titres » prend à tort
 * pour des offres. On retourne alors le seul vrai titre (le h1). `null` si ce
 * n'est pas une fiche unique (0 ou plusieurs intitulés → page liste : repli
 * normal, ex. BR Climatisation = 4 postes).
 */
function singleJobDetailOffer(
  html: string,
  careersUrl: string,
  id: string,
  company: string,
): RawJob | null {
  const $ = cheerio.load(html);
  const body = $("body").text().replace(/\s+/g, " ");
  const sectionRes = [
    /description du poste/i,
    /responsabilit[ée]s?/i,
    /exigences?/i,
    /avantages/i,
    /profil recherch/i,
    /t[âa]ches? (principales|et)/i,
    /conditions? de travail/i,
    /ce que (nous offrons|tu)/i,
  ];
  if (sectionRes.filter((re) => re.test(body)).length < 2) return null;
  const titles: string[] = [];
  $("h1,h2,h3").each((_, h) => {
    const t = cleanText($(h).text());
    const probe = t.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
    if (
      t.length >= 4 &&
      t.length <= 120 &&
      JOB_TITLE_HINT.test(probe) &&
      !SECTION_LABEL.test(probe) &&
      !NAV_LABELS.test(t) &&
      !MARKETING_PREFIX.test(probe) &&
      !/\b(recherch(?:e|é|è|ez|ons|ent|ait)s?|recrutons|embauchons|cherchons)\b/i.test(probe) &&
      !/[.!?]$/.test(t)
    )
      titles.push(t);
  });
  const uniq = [...new Set(titles)];
  if (uniq.length !== 1) return null;
  return { sourceId: id, url: careersUrl, title: uniq[0] as string, company, tags: [] };
}

/**
 * Détecte un contenu **binaire** servi en dur (PDF, doc…) : décodé en texte,
 * cheerio en extrait du charabia (« %PDF-1.5 %���� … »). On le rejette pour ne
 * pas polluer les descriptions.
 */
function looksBinary(html: string): boolean {
  const head = html.slice(0, 2000);
  if (/^\s*%PDF-/.test(head)) return true;
  let bad = 0;
  for (let i = 0; i < head.length; i++) {
    const c = head.charCodeAt(i);
    // caractère de remplacement (0xFFFD) ou contrôle non imprimable
    if (c === 0xfffd || c < 9 || (c > 13 && c < 32)) bad++;
  }
  return bad / Math.max(1, head.length) > 0.02;
}

/**
 * Texte du **contenu principal** d'une fiche de poste — sert de description
 * quand la page n'expose pas de JSON-LD. On retire la navigation/pied de page,
 * puis on prend le plus grand conteneur de contenu (article/main/.entry-content…).
 */
function mainContentText(html: string): string | undefined {
  if (looksBinary(html)) return undefined;
  const $ = cheerio.load(html);
  $(
    "script,style,nav,header,footer,form,svg,noscript,aside,.menu,.nav,.navbar,.header,.footer,.breadcrumb,.cookie,.share,.social,.related",
  ).remove();
  const candidates = [
    "[class*=job-description]",
    "[class*=job_description]",
    "[class*=offre-emploi]",
    "article",
    "main",
    "[role=main]",
    ".entry-content",
    ".single-content",
    ".post-content",
    ".content",
    "#content",
  ];
  let best = "";
  for (const sel of candidates) {
    $(sel).each((_, el) => {
      const t = cleanText($(el).text());
      if (t.length > best.length) best = t;
    });
    if (best.length >= 400) break;
  }
  if (best.length < 200) best = cleanText($("body").text());
  // Retire les amorces de navigation récurrentes en tête de contenu
  // (« Aller au contenu », « Postuler », « Skip to content », « Offre d'emploi »…),
  // de façon itérative car elles s'enchaînent souvent.
  const leadNoise =
    /^\s*(aller au contenu|passer au contenu|skip to (main )?content|postuler( dès maintenant| now)?|partager(\s+l['’]offre)?|offres?\s+d['’]emplois?)\s*/i;
  let prev: string;
  do {
    prev = best;
    best = best.replace(leadNoise, "").trim();
  } while (best !== prev);
  if (best.length < 120) return undefined; // trop court → probablement pas une description
  return best.length > 1200 ? `${best.slice(0, 1199)}…` : best;
}

/** Description d'une fiche : JSON-LD JobPosting d'abord, sinon contenu principal. */
function extractDetailDescription(html: string, sourceId: string, url: string): string | undefined {
  const fromLd = extractJsonLdJobs(html, sourceId, url).find((j) => j.description)?.description;
  return fromLd ?? mainContentText(html);
}

export function makeCareersScraper(config: CareersScraperConfig): Scraper {
  return {
    id: config.id,

    parseList(html: string, baseUrl: string): RawJob[] {
      const jsonld = extractJsonLdJobs(html, config.id, baseUrl);
      if (jsonld.length > 0) {
        // JSON-LD sans URL réelle par offre (toutes résolues en #fragment de la
        // page carrières) = données structurées incomplètes/décoratives : la page
        // n'expose qu'une partie des postes ainsi, les vraies fiches vivant en
        // sous-pages (ex. can-explore : 2 offres en JSON-LD, 9 vraies fiches
        // /carrieres/<slug>/). Si l'extraction par liens trouve STRICTEMENT plus
        // de postes (vraies URLs), on la préfère ; sinon on garde le JSON-LD
        // (plus riche : lieu, salaire, description).
        const allHashUrls = jsonld.every((j) => j.url.includes("#"));
        if (allHashUrls) {
          const links = parseHtmlCareers(html, baseUrl, config.careersUrl, config.id, config.company);
          if (links.length > jsonld.length) return links;
        }
        return jsonld;
      }
      const wix = parseWixRepeaters(html, baseUrl, config.careersUrl, config.id, config.company);
      if (wix.length > 0) return wix;
      // Gabarit ATS « jobs-listing » (glowinthecloud & co.) : liens
      // /{entreprise}/{id} sans mot-clé, ratés par le repli « liens » générique.
      const listing = parseJobsListing(html, config.careersUrl, config.id, config.company);
      if (listing.length > 0) return listing;
      // Page = une seule fiche de poste (sections description/exigences/avantages
      // + un seul intitulé de métier) : on retourne le vrai titre, sans capter
      // les puces de description qui contiennent des mots de métier.
      const single = singleJobDetailOffer(html, config.careersUrl, config.id, config.company);
      if (single) return [single];
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
      // Repli « titres » désactivé si la page déclare n'avoir aucun poste ouvert
      // (sinon on capte la vitrine des métiers comme de fausses offres).
      const heads = pageDeclaresNoOpenings(html)
        ? []
        : parseHeadingJobs(html, config.careersUrl, config.id, config.company);
      // Les vraies fiches (URLs réelles, hors #fragment) sont un signal plus fort
      // que le repli « titres » en #fragment (qui capte souvent une vitrine de
      // métiers en plus des vrais postes). On les préfère dès qu'elles couvrent
      // quasi autant de postes (à un près).
      const realDetail = links.filter((j) => !j.url.includes("#")).length;
      if (realDetail > 0 && realDetail + 1 >= heads.length) return links;
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

      // Enrichissement par la fiche : pour les offres à URL réelle sans
      // description OU sans lieu, on récupère la fiche et on complète depuis son
      // JSON-LD (description, lieu, salaire, type, date) — sinon on tire au moins
      // la description du contenu principal. Borné par employeur (politesse).
      const DETAIL_CAP = 15;
      let enriched = 0;
      for (const job of jobs) {
        if (enriched >= DETAIL_CAP) break;
        if (job.description && job.location) continue;
        if (!/^https?:\/\//i.test(job.url) || job.url.includes("#")) continue;
        // Fiche = page HTML : on évite les fichiers (PDF, doc, image…) — cheerio
        // n'en tirerait que du binaire illisible.
        if (/\.(pdf|docx?|xlsx?|pptx?|zip|rar|jpe?g|png|gif|webp|svg|mp4|mov)(\?|$)/i.test(job.url)) continue;
        // Même *chemin* que la page carrières (variante `?poste=…` d'une appli
        // côté client) : ce n'est pas une vraie fiche — la récupérer renverrait
        // le même contenu générique pour toutes les offres.
        if (sameUrl(stripQuery(job.url), stripQuery(config.careersUrl))) continue;
        enriched++;
        try {
          const detailHtml = await ctx.fetchHtml(job.url);
          const ld = extractJsonLdJobs(detailHtml, config.id, job.url).find((j) => j.description || j.location);
          if (!job.description) job.description = ld?.description ?? mainContentText(detailHtml);
          if (ld) {
            if (!job.location && ld.location) job.location = ld.location;
            if (job.salaryMin == null && ld.salaryMin != null) {
              job.salaryMin = ld.salaryMin;
              job.salaryMax = ld.salaryMax;
              job.salaryPeriod = ld.salaryPeriod;
            }
            if (!job.employmentType && ld.employmentType) job.employmentType = ld.employmentType;
            if (!job.postedAt && ld.postedAt) job.postedAt = ld.postedAt;
          }
        } catch {
          /* fiche inaccessible → on garde l'offre en l'état */
        }
      }
      if (enriched > 0) {
        const n = jobs.filter((j) => j.description).length;
        ctx.log(`${config.id} — descriptions : ${n}/${jobs.length}`);
      }

      if (jobs.length === 0) {
        // Page carrières **récupérée** (site joignable) et sans aucune offre. On
        // le signale pour permettre la purge des offres périmées. `explicit` = la
        // page le déclare noir sur blanc (« aucune offre en ce moment ») → purge
        // quelle que soit la taille ; sinon (page réelle substantielle, pas une
        // courte page de défi) → purge seulement des petites sources, cf.
        // syncSourceJobs. Une page trop courte (blocage déguisé) n'émet rien.
        const explicit = pageDeclaresNoOpenings(html);
        if (explicit || html.length > 2000) ctx.markNoOpenings?.(explicit);
      }
      ctx.log(`${config.id} — ${jobs.length} poste(s) trouvé(s)`);
      return jobs;
    },
  };
}

export interface RefineCareersOptions {
  /** Titres à écarter (faux positifs : nom d'entreprise, exigences, etc.). */
  drop?: RegExp;
  /** Lieu par défaut appliqué aux offres sans lieu (→ détection de région). */
  defaultLocation?: string;
}

/**
 * Enveloppe `makeCareersScraper` pour les pages carrières « accordéon/liens »
 * qui marchent avec le repli générique mais nécessitent un léger nettoyage :
 * retirer des titres parasites (`drop`) et/ou poser un lieu par défaut
 * (`defaultLocation`) quand la page n'indique pas de ville par poste — afin que
 * la région se détecte. Réutilise tout le reste (fetch, enrichissement, purge).
 */
export function refineCareers(config: CareersScraperConfig, opts: RefineCareersOptions = {}): Scraper {
  const base = makeCareersScraper(config);
  const refine = (jobs: RawJob[]): RawJob[] =>
    jobs
      .filter((j) => !(opts.drop && opts.drop.test(j.title)))
      .map((j) =>
        opts.defaultLocation && !j.location?.trim() ? { ...j, location: opts.defaultLocation } : j,
      );
  return {
    id: base.id,
    parseList: (html, baseUrl) => refine(base.parseList!(html, baseUrl)),
    scrape: async (params, ctx) => refine(await base.scrape(params, ctx)),
  };
}
