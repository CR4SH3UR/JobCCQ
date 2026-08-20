/**
 * Types et taxonomie « partagés », recopiés localement depuis le package
 * `@jobccq/shared` (packages/shared/src/types.ts, taxonomy.ts, sources.ts).
 *
 * L'app mobile est volontairement autonome : elle n'importe PAS
 * `@jobccq/shared` pour éviter les soucis de résolution de module hors
 * workspace avec Metro. Si la taxonomie ou le contrat de l'API évoluent côté
 * back-end, reporte les changements ici.
 */

// ---------------------------------------------------------------------------
// Taxonomie (id → libellé FR) — recopie fidèle de packages/shared/src/taxonomy.ts
// ---------------------------------------------------------------------------

export interface TaxonomyItem {
  readonly id: string;
  readonly label: string;
}

/** Les 17 régions administratives du Québec + valeurs transversales. */
export const QUEBEC_REGIONS: readonly TaxonomyItem[] = [
  { id: "bas-saint-laurent", label: "Bas-Saint-Laurent" },
  { id: "saguenay-lac-saint-jean", label: "Saguenay–Lac-Saint-Jean" },
  { id: "capitale-nationale", label: "Capitale-Nationale (Québec)" },
  { id: "mauricie", label: "Mauricie" },
  { id: "estrie", label: "Estrie" },
  { id: "montreal", label: "Montréal" },
  { id: "outaouais", label: "Outaouais" },
  { id: "abitibi-temiscamingue", label: "Abitibi-Témiscamingue" },
  { id: "cote-nord", label: "Côte-Nord" },
  { id: "nord-du-quebec", label: "Nord-du-Québec" },
  { id: "gaspesie-iles-de-la-madeleine", label: "Gaspésie–Îles-de-la-Madeleine" },
  { id: "chaudiere-appalaches", label: "Chaudière-Appalaches" },
  { id: "laval", label: "Laval" },
  { id: "lanaudiere", label: "Lanaudière" },
  { id: "laurentides", label: "Laurentides" },
  { id: "monteregie", label: "Montérégie" },
  { id: "centre-du-quebec", label: "Centre-du-Québec" },
  { id: "teletravail", label: "Télétravail (partout)" },
  { id: "canada-autre", label: "Canada (hors Québec)" },
  { id: "autre", label: "Autre / non précisé" },
];

/** Grands domaines d'emploi. */
export const JOB_CATEGORIES: readonly TaxonomyItem[] = [
  { id: "ti", label: "Informatique et TI" },
  { id: "genie", label: "Génie et ingénierie" },
  { id: "sante", label: "Santé et services sociaux" },
  { id: "construction", label: "Construction et métiers" },
  { id: "finance", label: "Finance, comptabilité et assurance" },
  { id: "admin", label: "Administration et bureautique" },
  { id: "vente", label: "Vente et service à la clientèle" },
  { id: "marketing", label: "Marketing et communications" },
  { id: "rh", label: "Ressources humaines" },
  { id: "education", label: "Éducation et formation" },
  { id: "juridique", label: "Juridique" },
  { id: "logistique", label: "Transport et logistique" },
  { id: "production", label: "Production et manufacture" },
  { id: "restauration", label: "Restauration, tourisme et hôtellerie" },
  { id: "arts", label: "Arts, design et culture" },
  { id: "science", label: "Sciences et recherche" },
  { id: "direction", label: "Direction et gestion" },
  { id: "autre", label: "Autre" },
];

/** Type de poste. */
export const EMPLOYMENT_TYPES: readonly TaxonomyItem[] = [
  { id: "temps-plein", label: "Temps plein" },
  { id: "temps-partiel", label: "Temps partiel" },
  { id: "contrat", label: "Contrat / temporaire" },
  { id: "stage", label: "Stage" },
  { id: "saisonnier", label: "Saisonnier" },
  { id: "occasionnel", label: "Occasionnel" },
];

/** Mode de travail. */
export const REMOTE_TYPES: readonly TaxonomyItem[] = [
  { id: "presentiel", label: "Présentiel" },
  { id: "hybride", label: "Hybride" },
  { id: "teletravail", label: "Télétravail" },
];

/** Exigence linguistique. */
export const LANGUAGES: readonly TaxonomyItem[] = [
  { id: "fr", label: "Français" },
  { id: "en", label: "Anglais" },
  { id: "bilingue", label: "Bilingue (FR/EN)" },
];

/** Période de rémunération. */
export const SALARY_PERIODS: readonly TaxonomyItem[] = [
  { id: "heure", label: "/ heure" },
  { id: "semaine", label: "/ semaine" },
  { id: "mois", label: "/ mois" },
  { id: "annee", label: "/ an" },
];

function indexBy(items: readonly TaxonomyItem[]): Record<string, string> {
  return Object.fromEntries(items.map((i) => [i.id, i.label]));
}

const REGION_LABELS = indexBy(QUEBEC_REGIONS);
const CATEGORY_LABELS = indexBy(JOB_CATEGORIES);
const EMPLOYMENT_LABELS = indexBy(EMPLOYMENT_TYPES);
const REMOTE_LABELS = indexBy(REMOTE_TYPES);
const LANGUAGE_LABELS = indexBy(LANGUAGES);
const SALARY_PERIOD_LABELS = indexBy(SALARY_PERIODS);

export const labelForRegion = (id?: string | null): string | undefined =>
  id ? REGION_LABELS[id] ?? id : undefined;
export const labelForCategory = (id?: string | null): string | undefined =>
  id ? CATEGORY_LABELS[id] ?? id : undefined;
export const labelForEmployment = (id?: string | null): string | undefined =>
  id ? EMPLOYMENT_LABELS[id] ?? id : undefined;
export const labelForRemote = (id?: string | null): string | undefined =>
  id ? REMOTE_LABELS[id] ?? id : undefined;
export const labelForLanguage = (id?: string | null): string | undefined =>
  id ? LANGUAGE_LABELS[id] ?? id : undefined;
export const labelForSalaryPeriod = (id?: string | null): string | undefined =>
  id ? SALARY_PERIOD_LABELS[id] ?? id : undefined;

// ---------------------------------------------------------------------------
// Sources — recopie fidèle de packages/shared/src/sources.ts
// ---------------------------------------------------------------------------

export type SourceRegion = "QC" | "CA" | "INTL";
export type SourceMethod = "html" | "headless" | "api" | "rss";
export type SourceStatus = "active" | "experimental" | "planned";

export interface JobSource {
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

export const JOB_SOURCES: readonly JobSource[] = [
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
];

const SOURCE_BY_ID: Record<string, JobSource> = Object.fromEntries(
  JOB_SOURCES.map((s) => [s.id, s]),
);

export const getSource = (id?: string | null): JobSource | undefined =>
  id ? SOURCE_BY_ID[id] : undefined;

export const sourceName = (id?: string | null): string =>
  (id && SOURCE_BY_ID[id]?.name) || id || "Source inconnue";

// ---------------------------------------------------------------------------
// Modèle de données — recopie fidèle de packages/shared/src/types.ts
// ---------------------------------------------------------------------------

/** Modèle normalisé d'une offre d'emploi, tel que renvoyé par l'API. */
export interface Job {
  /** Identifiant stable (hash de source + url/titre + entreprise). */
  id: string;
  /** Identifiant de la source (voir JOB_SOURCES), ex. "jobillico". */
  sourceId: string;
  /** URL de l'offre originale. */
  url: string;

  title: string;
  company: string;
  companyLogoUrl?: string;

  /** Localisation brute telle qu'affichée par la source. */
  location?: string;
  /** Région administrative normalisée (id de QUEBEC_REGIONS). */
  regionId?: string;
  city?: string;

  /** Mode de travail (id de REMOTE_TYPES). */
  remote?: "presentiel" | "hybride" | "teletravail";
  /** Grand domaine (id de JOB_CATEGORIES). */
  categoryId?: string;
  /** Type de poste (id de EMPLOYMENT_TYPES). */
  employmentType?:
    | "temps-plein"
    | "temps-partiel"
    | "contrat"
    | "stage"
    | "saisonnier"
    | "occasionnel";

  salaryMin?: number;
  salaryMax?: number;
  salaryPeriod?: "heure" | "semaine" | "mois" | "annee";
  currency?: string;

  /** Résumé / description (texte nettoyé, peut être tronqué). */
  description?: string;
  tags: string[];
  languages: ("fr" | "en" | "bilingue")[];

  /** Date de publication (ISO), si connue. */
  postedAt?: string;
  /** Date de collecte par le scraper (ISO). */
  scrapedAt: string;
}

/** Options de tri des résultats. */
export const SORT_OPTIONS = [
  "recent",
  "salary_desc",
  "salary_asc",
  "company",
  "relevance",
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

/** Requête de recherche / filtrage (paramètres envoyés à l'API). */
export interface JobQuery {
  q?: string;
  company?: string;
  regions?: string[];
  cities?: string[];
  categories?: string[];
  employmentTypes?: string[];
  remote?: ("presentiel" | "hybride" | "teletravail")[];
  sources?: string[];
  languages?: ("fr" | "en" | "bilingue")[];
  salaryMin?: number;
  postedWithinDays?: number;
  sort: SortOption;
  page: number;
  pageSize: number;
}

/** Décompte pour une facette (ex. combien d'offres par région). */
export interface FacetCount {
  id: string;
  label: string;
  count: number;
}

export interface JobFacets {
  regions: FacetCount[];
  categories: FacetCount[];
  employmentTypes: FacetCount[];
  remote: FacetCount[];
  sources: FacetCount[];
  languages: FacetCount[];
}

/** Réponse paginée de recherche d'offres (GET /api/jobs). */
export interface JobSearchResult {
  items: Job[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: JobFacets;
}

/** Entreprise qui recrute (agrégat pour la vue « Qui recrute »). */
export interface HiringCompany {
  company: string;
  companyLogoUrl?: string;
  openings: number;
  categories: string[];
  regions: string[];
  latestPostedAt?: string;
  sources: string[];
}

/** Source enrichie des métadonnées renvoyées par GET /api/sources. */
export type SourceWithMeta = JobSource & { hasScraper: boolean; jobCount: number };

/** Statistiques globales renvoyées par GET /api/stats. */
export interface Stats {
  totalJobs: number;
  totalCompanies: number;
  bySource: { id: string; count: number }[];
  byRegion: { id: string; count: number }[];
  byCategory: { id: string; count: number }[];
  recentRuns: unknown[];
}

/** Construit une requête complète à partir de filtres partiels (défauts sort/page/pageSize). */
export function buildQuery(partial: Partial<JobQuery>): JobQuery {
  return {
    sort: "recent",
    page: 1,
    pageSize: 20,
    ...partial,
  } as JobQuery;
}
