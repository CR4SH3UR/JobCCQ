/**
 * Répertoire des sources d'emploi — **construction et génie civil au Québec**.
 *
 * JobCCQ se concentre sur les employeurs de la construction (entrepreneurs,
 * génie civil, métiers CCQ). Chaque site est une entrée du catalogue. Un
 * scraper peut être :
 *  - `active`       : parseur implémenté et branché dans l'API ;
 *  - `experimental` : parseur écrit mais à valider (structure du site mouvante) ;
 *  - `planned`      : site répertorié, scraper à écrire.
 *
 * Ce catalogue est partagé : l'API l'utilise pour orchestrer le scraping,
 * le site et l'app l'affichent dans la page « Sources ».
 * Pour ajouter un site : ajoute une entrée ici, puis (optionnel) un scraper
 * dans apps/api/src/scrapers/ portant le même `id`.
 */

export type SourceRegion = "QC" | "CA" | "INTL";
export type SourceMethod = "html" | "headless" | "api" | "rss";
export type SourceStatus = "active" | "experimental" | "planned";

export interface JobSource {
  /** Identifiant stable, utilisé aussi comme id du scraper. */
  readonly id: string;
  readonly name: string;
  readonly homepage: string;
  /** Portée géographique principale. */
  readonly region: SourceRegion;
  /** Description courte du créneau du site. */
  readonly scope: string;
  /** Comment on récupère les offres. */
  readonly method: SourceMethod;
  readonly status: SourceStatus;
  readonly language: "fr" | "en" | "bilingue";
  /** Source mise en avant sur la page « Sources ». */
  readonly featured?: boolean;
  readonly notes?: string;
  /** Secteurs de construction de l'employeur (Résidentiel, Génie civil…). */
  readonly sectors?: readonly string[];
  /** Source désactivée (false) : ni scrapée, ni affichée sur le site. */
  readonly enabled?: boolean;
}

export const JOB_SOURCES = [
  {
    id: "pomerleau",
    sectors: ["Génie civil","Commercial et institutionnel","Résidentiel"],
    name: "Pomerleau",
    homepage: "https://jobs.pomerleau.ca/fr_CA/Jobs",
    region: "QC",
    scope: "Employeur — grand entrepreneur en construction et génie civil",
    method: "html",
    status: "active",
    language: "bilingue",
    featured: true,
    notes: "Portail carrières Avature (jobs.pomerleau.ca) : offres lues via SearchJobs (paginé jobOffset), plafonnées.",
  },
  {
    id: "ebc",
    sectors: ["Génie civil","Commercial et institutionnel","Mines"],
    name: "EBC",
    homepage: "https://ebcinc.com/fr/carrieres/emplois/",
    region: "QC",
    scope: "Employeur — génie civil, bâtiment et mines",
    method: "rss",
    status: "active",
    language: "fr",
    notes: "Page carrières WordPress (postes en AJAX) : offres lues via le flux RSS /fr/job/feed/ (paginé).",
  },
  {
    id: "lafontaine",
    sectors: ["Génie civil"],
    name: "Les Excavations Lafontaine",
    homepage: "https://lafontaineinc.zohorecruit.com/jobs/Careers",
    region: "QC",
    scope: "Employeur — génie civil et construction (portail Zoho Recruit)",
    method: "rss",
    status: "active",
    language: "fr",
    notes: "Portail carrières Zoho Recruit : offres lues via le flux RSS /jobs/Careers/rss.",
  },
  {
    id: "atwill-morin",
    sectors: ["Maçonnerie","Restauration de bâtiments"],
    name: "Atwill-Morin",
    homepage: "https://atwill-morin.com/carrieres/",
    region: "QC",
    scope: "Employeur — maçonnerie et restauration de bâtiments (ATS BambooHR)",
    method: "api",
    status: "active",
    language: "fr",
    notes: "Page carrières WordPress alimentée par BambooHR : offres lues via le flux JSON atwillmorin.bamboohr.com/careers/list.",
  },
  {
    id: "hamel-construction",
    sectors: ["Génie civil","Construction générale"],
    name: "Hamel Construction",
    homepage: "https://www.hamelconstruction.com/carrieres",
    region: "QC",
    scope: "Employeur — entrepreneur en construction (page carrières)",
    method: "html",
    status: "active",
    language: "fr",
    notes: "Page carrières Wix : postes lus depuis le .wixui-repeater (titre, lieu, type, lien).",
  },
  {
    id: "leqel",
    sectors: ["Électricité","Génie civil"],
    name: "LEQEL / LEQEL Énergie",
    homepage: "https://www.leqel.ca/carriere/",
    region: "QC",
    scope: "Employeur — lignes et postes électriques (réseau Hydro-Québec)",
    method: "html",
    status: "active",
    language: "fr",
    notes: "Page carrières WordPress : postes en liens /emploi-<slug>/ dans le HTML.",
  },
  {
    id: "beluga",
    sectors: ["Génie civil","Mines"],
    name: "Béluga Construction",
    homepage: "https://constructionbeluga.zohorecruit.ca/jobs/Careers",
    region: "QC",
    scope: "Employeur — génie civil, égout/aqueduc et mines",
    method: "api",
    status: "active",
    language: "fr",
    notes: "Portail Zoho Recruit (RSS désactivé) : offres lues depuis le JSON embarqué (input#jobs) de la page carrières.",
  },
  {
    id: "jmdemers",
    sectors: ["Génie civil","Béton et structure"],
    name: "JM Demers Excavation",
    homepage: "https://www.jmdemers.com/carriere",
    region: "QC",
    scope: "Employeur — excavation, génie civil et béton",
    method: "html",
    status: "active",
    language: "fr",
    notes: "Page carrières Wix : postes lus depuis les intitulés (repli « titres »).",
  },
  {
    id: "portneuf",
    sectors: ["Génie civil"],
    name: "Construction & Pavage Portneuf",
    homepage: "https://www.jobillico.com/fr/employeurs/construction-pavage-portneuf-inc-eBlqIn/voir-liste-emplois",
    region: "QC",
    scope: "Employeur — pavage, terrassement et génie civil",
    method: "html",
    status: "active",
    language: "fr",
    notes: "Page employeur Jobillico : ItemList → fiches JobPosting (lieu, salaire).",
  },
  {
    id: "cote-et-fils",
    sectors: ["Construction générale"],
    name: "Construction Côté et fils",
    homepage: "https://www.jobillico.com/voir-entreprise/construction-cote-fils.tZkiVw",
    region: "QC",
    scope: "Employeur — entrepreneur en construction",
    method: "html",
    status: "active",
    language: "fr",
    notes: "Page employeur Jobillico : ItemList → fiches JobPosting.",
  },
  {
    id: "jcdrolet",
    sectors: ["Génie civil"],
    name: "JC Drolet",
    homepage: "https://jcdrolet.com/carrieres/",
    region: "QC",
    scope: "Employeur — génie civil, excavation et déneigement",
    method: "html",
    status: "active",
    language: "fr",
    notes: "Page carrières WordPress : postes lus depuis les intitulés (repli « titres »).",
  },
  {
    id: "lefrancois",
    sectors: ["Béton et structure","Génie civil"],
    name: "Lefrançois",
    homepage: "https://www.lefrancoisinc.ca/carrières",
    region: "QC",
    scope: "Employeur — coffrage, béton et génie civil",
    method: "html",
    status: "active",
    language: "fr",
    notes: "Page carrières Wix : postes lus depuis les intitulés (repli « titres »).",
  },
  {
    id: "refrabec",
    sectors: ["Maçonnerie"],
    name: "Refrabec",
    homepage: "https://refrabec.qc.ca/carrieres/",
    region: "QC",
    scope: "Employeur — réfractaire et maçonnerie industrielle",
    method: "html",
    status: "experimental",
    language: "fr",
    notes: "Scraper branché mais aucun poste détecté pour l'instant (structure de page à valider).",
  },
  {
    id: "ccq-construction",
    name: "CCQ — Carrefour construction",
    homepage: "https://www.ccq.org",
    region: "QC",
    scope: "Commission de la construction du Québec — métiers de la construction",
    method: "html",
    status: "planned",
    language: "fr",
  },
] as const satisfies readonly JobSource[];

export type JobSourceId = (typeof JOB_SOURCES)[number]["id"];

// --- Employeurs découverts automatiquement (registre RBQ) ------------------

import discoveredRaw from "./discovered.json";

/** Méthode d'accès détectée pour un employeur découvert. */
export type DiscoveredMethod =
  | "html"
  | "jsonld"
  | "zoho"
  | "bamboohr"
  | "avature"
  | "greenhouse"
  | "lever"
  | "recruitee"
  | "smartrecruiters"
  | "teamtailor"
  | "ultipro"
  | "jackstaff"
  | "jobillico";

/** Entrée du registre auto-découvert (data-driven ; voir discovered.json). */
export interface DiscoveredEmployer {
  readonly id: string;
  readonly name: string;
  readonly homepage: string;
  /** URL de la page carrières (ou du flux/endpoint pour un ATS). */
  readonly careersUrl: string;
  readonly method: DiscoveredMethod;
  /** Région administrative RBQ (indicative). */
  readonly region?: string;
  readonly scope?: string;
  /** Secteurs de construction (dérivés du nom + classification RBQ). */
  readonly sectors?: readonly string[];
  /** Vérifié manuellement (console d'administration) : l'URL et les postes sont bons. */
  readonly verified?: boolean;
  /** Source désactivée (false) : ni scrapée, ni affichée sur le site. */
  readonly enabled?: boolean;
}

export const DISCOVERED_EMPLOYERS = discoveredRaw as readonly DiscoveredEmployer[];

const methodToSourceMethod = (m: DiscoveredMethod): SourceMethod =>
  m === "html" || m === "jsonld" || m === "jobillico"
    ? "html"
    : m === "zoho"
      ? "rss"
      : "api";

const DISCOVERED_AS_SOURCES: readonly JobSource[] = DISCOVERED_EMPLOYERS.map((d) => ({
  id: d.id,
  name: d.name,
  homepage: d.homepage,
  region: "QC",
  scope: d.scope ?? "Employeur — construction (découverte RBQ)",
  method: methodToSourceMethod(d.method),
  status: "active",
  language: "fr",
  sectors: d.sectors,
  enabled: d.enabled,
}));

/** Toutes les sources : catalogue curé + employeurs auto-découverts. */
export const ALL_SOURCES: readonly JobSource[] = [...JOB_SOURCES, ...DISCOVERED_AS_SOURCES];

const SOURCE_BY_ID: Record<string, JobSource> = Object.fromEntries(
  ALL_SOURCES.map((s) => [s.id, s]),
);

export const getSource = (id?: string | null): JobSource | undefined =>
  id ? SOURCE_BY_ID[id] : undefined;

export const sourceName = (id?: string | null): string =>
  (id && SOURCE_BY_ID[id]?.name) || id || "Source inconnue";

export const activeSources = (): JobSource[] =>
  ALL_SOURCES.filter((s) => s.status !== "planned" && s.enabled !== false);

/** Ids des sources désactivées (à exclure du scraping et de l'affichage). */
export const DISABLED_SOURCE_IDS: ReadonlySet<string> = new Set(
  ALL_SOURCES.filter((s) => s.enabled === false).map((s) => s.id),
);

/** Une source est-elle désactivée manuellement ? */
export const isSourceDisabled = (id?: string | null): boolean =>
  !!id && DISABLED_SOURCE_IDS.has(id);
