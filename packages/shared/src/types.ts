import { z } from "zod";

/**
 * Modèle normalisé d'une offre d'emploi.
 * Toutes les sources sont converties vers ce format commun.
 */
export const JobSchema = z.object({
  /** Identifiant stable (hash de source + url/titre + entreprise). */
  id: z.string(),
  /** Identifiant de la source (voir sources.ts), ex. "jobillico". */
  sourceId: z.string(),
  /** URL de l'offre originale. */
  url: z.string().url(),

  title: z.string(),
  company: z.string(),
  companyLogoUrl: z.string().url().optional(),

  /** Localisation brute telle qu'affichée par la source. */
  location: z.string().optional(),
  /** Région administrative normalisée (id de taxonomy QUEBEC_REGIONS). */
  regionId: z.string().optional(),
  city: z.string().optional(),

  /** Mode de travail (id de REMOTE_TYPES). */
  remote: z.enum(["presentiel", "hybride", "teletravail"]).optional(),
  /** Grand domaine (id de JOB_CATEGORIES). */
  categoryId: z.string().optional(),
  /** Type de poste (id de EMPLOYMENT_TYPES). */
  employmentType: z
    .enum(["temps-plein", "temps-partiel", "contrat", "stage", "saisonnier", "occasionnel"])
    .optional(),

  salaryMin: z.number().nonnegative().optional(),
  salaryMax: z.number().nonnegative().optional(),
  salaryPeriod: z.enum(["heure", "semaine", "mois", "annee"]).optional(),
  currency: z.string().default("CAD").optional(),

  /** Résumé / description (texte nettoyé, peut être tronqué). */
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  languages: z.array(z.enum(["fr", "en", "bilingue"])).default([]),

  /** Date de publication (ISO), si connue. */
  postedAt: z.string().datetime().optional(),
  /** Date de collecte par le scraper (ISO). */
  scrapedAt: z.string().datetime(),
});

export type Job = z.infer<typeof JobSchema>;

/**
 * Offre « brute » renvoyée par un scraper avant normalisation/enrichissement.
 * Champs minimaux; l'orchestrateur complète le reste (id, regionId, catégorie…).
 */
export const RawJobSchema = z.object({
  sourceId: z.string(),
  url: z.string().url(),
  title: z.string().min(1),
  company: z.string().min(1),
  companyLogoUrl: z.string().url().optional(),
  location: z.string().optional(),
  remote: z.enum(["presentiel", "hybride", "teletravail"]).optional(),
  employmentType: z
    .enum(["temps-plein", "temps-partiel", "contrat", "stage", "saisonnier", "occasionnel"])
    .optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  salaryPeriod: z.enum(["heure", "semaine", "mois", "annee"]).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  postedAt: z.string().optional(),
});

export type RawJob = z.infer<typeof RawJobSchema>;

/** Options de tri des résultats. */
export const SORT_OPTIONS = [
  "recent",
  "salary_desc",
  "salary_asc",
  "company",
  "relevance",
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

/**
 * Requête de recherche / filtrage (paramètres de l'API et de l'UI).
 * `coerce` permet de parser directement des query-strings.
 */
export const JobQuerySchema = z.object({
  q: z.string().trim().optional(),
  company: z.string().trim().optional(),
  regions: z.array(z.string()).optional(),
  cities: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  employmentTypes: z.array(z.string()).optional(),
  remote: z.array(z.enum(["presentiel", "hybride", "teletravail"])).optional(),
  sources: z.array(z.string()).optional(),
  languages: z.array(z.enum(["fr", "en", "bilingue"])).optional(),
  salaryMin: z.coerce.number().nonnegative().optional(),
  postedWithinDays: z.coerce.number().int().positive().optional(),
  sort: z.enum(SORT_OPTIONS).default("recent"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type JobQuery = z.infer<typeof JobQuerySchema>;

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

/** Réponse paginée de recherche d'offres. */
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
