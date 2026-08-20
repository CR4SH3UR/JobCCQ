/**
 * Répertoire des sources d'emploi Québec / Canada.
 *
 * Chaque site est une entrée du catalogue. Un scraper peut être :
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
  /** Source mise en avant (Jobillico). */
  readonly featured?: boolean;
  readonly notes?: string;
}

export const JOB_SOURCES = [
  {
    id: "jobillico",
    name: "Jobillico",
    homepage: "https://www.jobillico.com",
    region: "QC",
    scope: "Généraliste — la plus grande plateforme d'emploi au Québec",
    method: "html",
    status: "active",
    language: "fr",
    featured: true,
    notes: "Source principale. Pagination /fr/recherche-emploi, fiches /fr/offre-emploi.",
  },
  {
    id: "jobboom",
    name: "Jobboom",
    homepage: "https://www.jobboom.com",
    region: "QC",
    scope: "Généraliste Québec",
    method: "html",
    status: "experimental",
    language: "fr",
  },
  {
    id: "guichet-emplois",
    name: "Guichet-Emplois (Job Bank)",
    homepage: "https://www.guichetemplois.gc.ca",
    region: "CA",
    scope: "Portail gouvernemental fédéral — offres partout au Canada",
    method: "html",
    status: "experimental",
    language: "bilingue",
    notes: "Flux structuré disponible; couverture nationale, filtrable par province.",
  },
  {
    id: "quebec-emploi",
    name: "Québec emploi (Services Québec)",
    homepage: "https://www.quebec.ca/emploi/placement-en-ligne",
    region: "QC",
    scope: "Placement en ligne du gouvernement du Québec",
    method: "html",
    status: "planned",
    language: "fr",
  },
  {
    id: "espresso-jobs",
    name: "Espresso-Jobs",
    homepage: "https://www.espresso-jobs.com",
    region: "QC",
    scope: "Spécialisé technologies / TI au Québec",
    method: "html",
    status: "experimental",
    language: "fr",
  },
  {
    id: "isarta",
    name: "Isarta",
    homepage: "https://isarta.com",
    region: "QC",
    scope: "Marketing, communication, création et médias",
    method: "html",
    status: "planned",
    language: "fr",
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
  {
    id: "atwill-morin",
    name: "Atwill-Morin",
    homepage: "https://atwill-morin.com/carrieres/",
    region: "QC",
    scope: "Employeur — maçonnerie et restauration de bâtiments (page carrières)",
    method: "html",
    status: "experimental",
    language: "fr",
    notes: "Page carrières d'entreprise (une seule page) : JSON-LD si disponible, sinon repli HTML.",
  },
  {
    id: "hamel-construction",
    name: "Hamel Construction",
    homepage: "https://www.hamelconstruction.com/carrieres",
    region: "QC",
    scope: "Employeur — entrepreneur en construction (page carrières)",
    method: "html",
    status: "experimental",
    language: "fr",
    notes: "Page carrières d'entreprise (une seule page) : JSON-LD si disponible, sinon repli HTML.",
  },
  {
    id: "pomerleau",
    name: "Pomerleau",
    homepage: "https://careers.pomerleau.ca",
    region: "QC",
    scope: "Employeur — grand entrepreneur en construction (portail carrières / ATS)",
    method: "headless",
    status: "experimental",
    language: "bilingue",
    notes: "Portail carrières (ATS) : JSON-LD/liens exploités si présents; un rendu headless (Playwright) ou l'API de l'ATS peut être requis.",
  },
  {
    id: "recrutement-sante",
    name: "Recrutement Santé Québec",
    homepage: "https://www.recrutementsantequebec.ca",
    region: "QC",
    scope: "Réseau de la santé et des services sociaux",
    method: "html",
    status: "planned",
    language: "fr",
  },
  {
    id: "carrieres-quebec",
    name: "Carrières — Gouvernement du Québec",
    homepage: "https://www.carrieres.gouv.qc.ca",
    region: "QC",
    scope: "Fonction publique québécoise",
    method: "html",
    status: "planned",
    language: "fr",
  },
  {
    id: "randstad-ca",
    name: "Randstad Canada",
    homepage: "https://www.randstad.ca",
    region: "CA",
    scope: "Agence de placement — nombreux mandats au Québec",
    method: "html",
    status: "planned",
    language: "bilingue",
  },
  {
    id: "indeed-ca",
    name: "Indeed Canada",
    homepage: "https://ca.indeed.com",
    region: "CA",
    scope: "Agrégateur généraliste (forte protection anti-robot)",
    method: "headless",
    status: "planned",
    language: "bilingue",
    notes: "Nécessite un navigateur headless (Playwright) et une bonne gestion du rythme.",
  },
  {
    id: "talent-ca",
    name: "Talent.com (Neuvoo)",
    homepage: "https://ca.talent.com",
    region: "CA",
    scope: "Agrégateur généraliste",
    method: "headless",
    status: "planned",
    language: "bilingue",
  },
  {
    id: "linkedin",
    name: "LinkedIn Jobs",
    homepage: "https://www.linkedin.com/jobs",
    region: "INTL",
    scope: "Réseau professionnel mondial",
    method: "headless",
    status: "planned",
    language: "bilingue",
    notes: "Scraping restreint par les CGU; privilégier l'API partenaire si disponible.",
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
  JOB_SOURCES.filter((s) => s.status === "active" || s.status === "experimental");
