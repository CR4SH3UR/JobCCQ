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
}

export const JOB_SOURCES = [
  {
    id: "pomerleau",
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

const SOURCE_BY_ID: Record<string, JobSource> = Object.fromEntries(
  JOB_SOURCES.map((s) => [s.id, s]),
);

export const getSource = (id?: string | null): JobSource | undefined =>
  id ? SOURCE_BY_ID[id] : undefined;

export const sourceName = (id?: string | null): string =>
  (id && SOURCE_BY_ID[id]?.name) || id || "Source inconnue";

export const activeSources = (): JobSource[] =>
  JOB_SOURCES.filter((s) => s.status !== "planned");
