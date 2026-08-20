import { createHash } from "node:crypto";
import type { Job, RawJob } from "@jobccq/shared";

/** Retire les accents et met en minuscules (comparaisons tolérantes). */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Identifiant stable et déterministe d'une offre. */
export function jobId(sourceId: string, url: string): string {
  return createHash("sha1").update(`${sourceId}|${url}`).digest("hex").slice(0, 16);
}

// --- Détection de la région à partir de la localisation --------------------

/** Ville / mot-clé → id de région administrative (voir taxonomy). */
const CITY_TO_REGION: Array<[RegExp, string]> = [
  [/montreal|montréal|ville-marie|verdun|lachine|anjou|outremont/i, "montreal"],
  [/laval/i, "laval"],
  [/longueuil|brossard|saint-hubert|st-hubert|boucherville|saint-jean-sur-richelieu|granby|sorel|chambly|varennes/i, "monteregie"],
  [/quebec|québec|sainte-foy|ste-foy|charlesbourg|beauport|l'ancienne-lorette/i, "capitale-nationale"],
  [/levis|lévis|thetford|sainte-marie|montmagny/i, "chaudiere-appalaches"],
  [/gatineau|hull|aylmer|outaouais/i, "outaouais"],
  [/sherbrooke|magog|granby|estrie/i, "estrie"],
  [/trois-rivieres|trois-rivières|shawinigan|mauricie/i, "mauricie"],
  [/drummondville|victoriaville|centre-du-quebec/i, "centre-du-quebec"],
  [/saguenay|chicoutimi|jonquiere|jonquière|alma|lac-saint-jean/i, "saguenay-lac-saint-jean"],
  [/rimouski|riviere-du-loup|rivière-du-loup|bas-saint-laurent|matane/i, "bas-saint-laurent"],
  [/rouyn|noranda|val-d'or|abitibi|amos/i, "abitibi-temiscamingue"],
  [/sept-iles|sept-îles|baie-comeau|cote-nord|côte-nord/i, "cote-nord"],
  [/gaspe|gaspé|iles-de-la-madeleine|îles-de-la-madeleine|gaspesie|gaspésie/i, "gaspesie-iles-de-la-madeleine"],
  [/repentigny|terrebonne|mascouche|joliette|lanaudiere|lanaudière/i, "lanaudiere"],
  [/saint-jerome|st-jerome|blainville|mirabel|sainte-therese|laurentides|mont-tremblant/i, "laurentides"],
  [/chibougamau|nord-du-quebec|nunavik|baie-james/i, "nord-du-quebec"],
];

const REMOTE_HINT = /télétravail|teletravail|à distance|a distance|remote|hybride/i;

export function detectRegion(location?: string): string | undefined {
  if (!location) return undefined;
  for (const [re, region] of CITY_TO_REGION) if (re.test(location)) return region;
  if (/télétravail|teletravail|à distance|a distance|remote/i.test(location)) return "teletravail";
  if (/canada|ontario|toronto|ottawa|alberta|colombie/i.test(location)) return "canada-autre";
  return undefined;
}

export function detectRemote(text: string): Job["remote"] | undefined {
  if (/hybride|hybrid/i.test(text)) return "hybride";
  if (/télétravail|teletravail|à distance|a distance|100%\s*remote|full remote|entièrement à distance/i.test(text))
    return "teletravail";
  if (/présentiel|presentiel|sur place|en personne/i.test(text)) return "presentiel";
  return undefined;
}

// --- Inférence du domaine à partir du titre --------------------------------

const CATEGORY_KEYWORDS: Array<[string, RegExp]> = [
  ["ti", /developpeu|développeu|programmeu|logiciel|software|devops|data|donnees|données|analyste (?:d'affaires|programmeur)|architecte (?:logiciel|ti)|infonuagique|cloud|cybersecurit|réseau|reseau|informatique|full ?stack|frontend|backend|qa|test|scrum|ux|ui designer|intelligence artificielle|machine learning/i],
  ["genie", /ingenieu|ingénieu|genie|génie|mecanique|mécanique|électrique|electrique|civil|structure|aérospat|aerospat|automatisation/i],
  ["sante", /infirmi|prepose|préposé|beneficiaire|bénéficiaire|medecin|médecin|pharmac|dentaire|physio|ergotherapeu|ergothérapeu|inhalotherapeu|psycholog|travailleu(?:r|se) social|soins|clinique|hospitali/i],
  ["construction", /electricien|électricien|plombier|charpentier|menuisier|macon|maçon|grutier|chantier|construction|manoeuvre|soudeur|couvreu|ferblantier|arpenteu|estimateu/i],
  ["finance", /comptab|financ|fiscal|controleu|contrôleu|analyste financier|actuaire|assurance|banque|credit|crédit|paie|verificateu|vérificateu|tresorerie|trésorerie/i],
  ["admin", /adjoint|secretai|secrétai|réceptionn|receptionn|commis|soutien administratif|bureautique|coordonnateu(?:r|rice) administra/i],
  ["vente", /vente|vendeu|conseiller (?:en vente|aux ventes)|representant|représentant|caissier|service (?:à la clientele|a la clientele|client)|commercial(?:e)?\b/i],
  ["marketing", /marketing|communication|redacteu|rédacteu|contenu|médias sociaux|medias sociaux|publicit|relations publiques|growth|seo/i],
  ["rh", /ressources humaines|recruteu|talent|conseiller rh|paie et avantages|dotation/i],
  ["education", /enseignant|professeu|educateu|éducateu|formateu|pedagog|pédagog|scolaire|garderie|cpe|orthopedagog/i],
  ["juridique", /avocat|juriste|notaire|parajuriste|juridique|technicien juridique/i],
  ["logistique", /logistique|entrepot|entrepôt|cariste|chauffeu|camionneu|livreu|approvisionn|chaine (?:d'approvisionnement|logistique)|magasinier|repartiteu|répartiteu|transport/i],
  ["production", /operateu|opérateu|production|assembleu|manutention|usine|manufactur|journalier|controle qualite|contrôle qualité|machiniste/i],
  ["restauration", /cuisinier|chef|serveu|barista|plongeu|restauration|hotel|hôtel|tourism|préposé (?:à l'accueil)|aide-cuisinier|gerant de restaurant/i],
  ["arts", /designer|graphiste|artiste|photograph|videast|vidéast|monteu|createu|créateu|illustrateu|musique|scenograph/i],
  ["science", /chercheu|scientifique|laboratoire|biolog|chimist|technicien de laboratoire|recherche et developpement|r&d|microbiolog/i],
  ["direction", /directeu|directrice|vice-president|vice-président|chef de (?:service|departement|département)|gestionnaire|president|président|pdg|dg\b|chef d'equipe|chef d'équipe/i],
];

export function inferCategory(title: string, tags: string[] = []): string | undefined {
  const hay = `${title} ${tags.join(" ")}`;
  for (const [cat, re] of CATEGORY_KEYWORDS) if (re.test(hay)) return cat;
  return undefined;
}

// --- Langues ---------------------------------------------------------------

export function detectLanguages(text: string): Job["languages"] {
  const langs = new Set<NonNullable<Job["languages"]>[number]>();
  if (/bilingue|bilingual|français et anglais|francais et anglais/i.test(text)) langs.add("bilingue");
  if (/anglais|english/i.test(text)) langs.add("en");
  if (/français|francais|french/i.test(text)) langs.add("fr");
  return [...langs];
}

// --- Salaire ---------------------------------------------------------------

const NUM = "(\\d[\\d\\s.,]*)";

function toNumber(raw: string): number | undefined {
  const cleaned = raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/** Extraction best-effort d'une fourchette salariale depuis un texte libre. */
export function parseSalary(text?: string):
  | { salaryMin?: number; salaryMax?: number; salaryPeriod?: Job["salaryPeriod"] }
  | undefined {
  if (!text) return undefined;
  const t = text.replace(/ /g, " ");

  // Période
  let period: Job["salaryPeriod"] | undefined;
  if (/de l'heure|\/\s*h(?:eure)?\b|horaire|par heure/i.test(t)) period = "heure";
  else if (/par (?:an|année|annee)|\/\s*an(?:née|nee)?\b|annuel/i.test(t)) period = "annee";
  else if (/par mois|\/\s*mois|mensuel/i.test(t)) period = "mois";
  else if (/par semaine|\/\s*semaine|hebdomadaire/i.test(t)) period = "semaine";

  // Fourchette « 55 000 $ à 75 000 $ » ou « 25 $ - 32 $ »
  const range = new RegExp(`${NUM}\\s*(?:k)?\\s*\\$?\\s*(?:à|a|-|–|to)\\s*${NUM}\\s*(?:k)?\\s*\\$`, "i");
  const single = new RegExp(`${NUM}\\s*(k)?\\s*\\$`, "i");

  let salaryMin: number | undefined;
  let salaryMax: number | undefined;
  const isK = /k\s*\$/i.test(t);

  const rm = t.match(range);
  if (rm) {
    salaryMin = toNumber(rm[1]!);
    salaryMax = toNumber(rm[2]!);
  } else {
    const sm = t.match(single);
    if (sm) salaryMin = salaryMax = toNumber(sm[1]!);
  }
  if (isK) {
    if (salaryMin && salaryMin < 1000) salaryMin *= 1000;
    if (salaryMax && salaryMax < 1000) salaryMax *= 1000;
  }
  if (!period) {
    // Heuristique : gros montant => annuel, petit => horaire
    const ref = salaryMax ?? salaryMin;
    if (ref != null) period = ref > 1000 ? "annee" : "heure";
  }
  if (salaryMin == null && salaryMax == null) return undefined;
  return { salaryMin, salaryMax, salaryPeriod: period };
}

// --- Normalisation complète ------------------------------------------------

/** Transforme une offre brute (scraper) en offre normalisée et enrichie. */
export function normalizeRawJob(raw: RawJob, now = new Date()): Job {
  const text = `${raw.title} ${raw.description ?? ""} ${raw.location ?? ""}`;
  const tags = raw.tags ?? [];

  const region = detectRegion(raw.location);
  const remote =
    raw.remote ?? (REMOTE_HINT.test(text) ? detectRemote(text) : undefined) ?? undefined;

  const salaryFromText =
    raw.salaryMin == null && raw.salaryMax == null ? parseSalary(raw.description) : undefined;

  let postedAt: string | undefined;
  if (raw.postedAt) {
    const t = Date.parse(raw.postedAt);
    if (!Number.isNaN(t)) postedAt = new Date(t).toISOString();
  }

  return {
    id: jobId(raw.sourceId, raw.url),
    sourceId: raw.sourceId,
    url: raw.url,
    title: raw.title.trim(),
    company: raw.company.trim(),
    companyLogoUrl: raw.companyLogoUrl,
    location: raw.location?.trim(),
    regionId: region,
    remote,
    categoryId: inferCategory(raw.title, tags),
    employmentType: raw.employmentType,
    salaryMin: raw.salaryMin ?? salaryFromText?.salaryMin,
    salaryMax: raw.salaryMax ?? salaryFromText?.salaryMax,
    salaryPeriod: raw.salaryPeriod ?? salaryFromText?.salaryPeriod,
    currency: "CAD",
    description: raw.description?.trim(),
    tags,
    languages: detectLanguages(text),
    postedAt,
    scrapedAt: now.toISOString(),
  };
}
