/**
 * Taxonomie du marché de l'emploi Québec / Canada.
 * Sert de référentiel commun à l'API, au site et à l'app mobile
 * (libellés en français, identifiants stables en interne).
 */

export interface TaxonomyItem {
  readonly id: string;
  readonly label: string;
}

/** Les 17 régions administratives du Québec + valeurs transversales. */
export const QUEBEC_REGIONS = [
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
] as const satisfies readonly TaxonomyItem[];

export type QuebecRegionId = (typeof QUEBEC_REGIONS)[number]["id"];

/** Grands domaines d'emploi. */
export const JOB_CATEGORIES = [
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
] as const satisfies readonly TaxonomyItem[];

export type JobCategoryId = (typeof JOB_CATEGORIES)[number]["id"];

/** Type de poste. */
export const EMPLOYMENT_TYPES = [
  { id: "temps-plein", label: "Temps plein" },
  { id: "temps-partiel", label: "Temps partiel" },
  { id: "contrat", label: "Contrat / temporaire" },
  { id: "stage", label: "Stage" },
  { id: "saisonnier", label: "Saisonnier" },
  { id: "occasionnel", label: "Occasionnel" },
] as const satisfies readonly TaxonomyItem[];

export type EmploymentTypeId = (typeof EMPLOYMENT_TYPES)[number]["id"];

/** Mode de travail. */
export const REMOTE_TYPES = [
  { id: "presentiel", label: "Présentiel" },
  { id: "hybride", label: "Hybride" },
  { id: "teletravail", label: "Télétravail" },
] as const satisfies readonly TaxonomyItem[];

export type RemoteTypeId = (typeof REMOTE_TYPES)[number]["id"];

/** Exigence linguistique. */
export const LANGUAGES = [
  { id: "fr", label: "Français" },
  { id: "en", label: "Anglais" },
  { id: "bilingue", label: "Bilingue (FR/EN)" },
] as const satisfies readonly TaxonomyItem[];

export type LanguageId = (typeof LANGUAGES)[number]["id"];

/** Période de rémunération. */
export const SALARY_PERIODS = [
  { id: "heure", label: "/ heure" },
  { id: "semaine", label: "/ semaine" },
  { id: "mois", label: "/ mois" },
  { id: "annee", label: "/ an" },
] as const satisfies readonly TaxonomyItem[];

export type SalaryPeriodId = (typeof SALARY_PERIODS)[number]["id"];

// --- Utilitaires de recherche de libellés ---------------------------------

function indexBy(items: readonly TaxonomyItem[]): Record<string, string> {
  return Object.fromEntries(items.map((i) => [i.id, i.label]));
}

const REGION_LABELS = indexBy(QUEBEC_REGIONS);
const CATEGORY_LABELS = indexBy(JOB_CATEGORIES);
const EMPLOYMENT_LABELS = indexBy(EMPLOYMENT_TYPES);
const REMOTE_LABELS = indexBy(REMOTE_TYPES);
const LANGUAGE_LABELS = indexBy(LANGUAGES);
const SALARY_PERIOD_LABELS = indexBy(SALARY_PERIODS);

export const labelForRegion = (id?: string | null) => (id ? REGION_LABELS[id] ?? id : undefined);
export const labelForCategory = (id?: string | null) => (id ? CATEGORY_LABELS[id] ?? id : undefined);
export const labelForEmployment = (id?: string | null) => (id ? EMPLOYMENT_LABELS[id] ?? id : undefined);
export const labelForRemote = (id?: string | null) => (id ? REMOTE_LABELS[id] ?? id : undefined);
export const labelForLanguage = (id?: string | null) => (id ? LANGUAGE_LABELS[id] ?? id : undefined);
export const labelForSalaryPeriod = (id?: string | null) =>
  id ? SALARY_PERIOD_LABELS[id] ?? id : undefined;
