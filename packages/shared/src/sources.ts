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
  // Les employeurs curés (Pomerleau, EBC, Béluga, Atwill-Morin, CCQ…) vivent
  // dans discovered.json (éditables en admin, scraper dédié via BESPOKE).
  // JOB_SOURCES reste le catalogue « source » pour la page /sources.
  {
    id: "ccq-construction",
    name: "CCQ — Carrefour construction",
    homepage: "https://carriere.ccq.org/",
    region: "QC",
    scope: "Commission de la construction du Québec — portail carrières public",
    method: "html",
    status: "active",
    language: "fr",
    notes:
      "SuccessFactors public (carriere.ccq.org). Le Carnet référence construction (ex-Carrefour) exige un compte — non importé.",
  },
] as const satisfies readonly JobSource[];

export type JobSourceId = (typeof JOB_SOURCES)[number]["id"];

// --- Employeurs découverts automatiquement (registre RBQ) ------------------

import discoveredRaw from "./discovered.json";
import { isLandscapingOrSnow, regionIdFromName } from "./taxonomy.js";

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
  /** 2e page carrières (ex. Jobillico en plus du site officiel). Scrapée sous le même id. */
  readonly careersUrl2?: string;
  readonly method2?: DiscoveredMethod;
  /** Région administrative RBQ (indicative). */
  readonly region?: string;
  /** Numéro de licence RBQ (indicatif, dérivé du registre). */
  readonly rbq?: string;
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

/** Toutes les sources : catalogue curé + employeurs auto-découverts (sans doublon d'id). */
export const ALL_SOURCES: readonly JobSource[] = [
  ...JOB_SOURCES,
  ...DISCOVERED_AS_SOURCES.filter((d) => !JOB_SOURCES.some((s) => s.id === d.id)),
];

const SOURCE_BY_ID: Record<string, JobSource> = Object.fromEntries(
  ALL_SOURCES.map((s) => [s.id, s]),
);

export const getSource = (id?: string | null): JobSource | undefined =>
  id ? SOURCE_BY_ID[id] : undefined;

const EMPLOYER_BY_ID: Record<string, DiscoveredEmployer> = Object.fromEntries(
  DISCOVERED_EMPLOYERS.map((e) => [e.id, e]),
);

/** Fiche employeur (registre RBQ) pour un id de source — porte `rbq`, `region`, `sectors`. */
export const getEmployer = (id?: string | null): DiscoveredEmployer | undefined =>
  id ? EMPLOYER_BY_ID[id] : undefined;

/** Page publique de recherche d'une licence RBQ. */
export function rbqLicenceUrl(rbq: string): string {
  const no = rbq.trim().replace(/\s+/g, "");
  return `https://www.rbq.gouv.qc.ca/entreprises-et-licences/rechercher-une-licence/?licence=${encodeURIComponent(no)}`;
}

/**
 * Secteurs à AFFICHER pour une offre : les secteurs de l'employeur, mais on
 * retire « Construction… » pour une offre d'entretien paysager / déneigement
 * (déneigement, tonte de pelouse) — elle ne relève pas de la construction.
 */
export function sectorsForJob(job: { sourceId?: string | null; title?: string | null }): string[] {
  const sectors = [...(getSource(job.sourceId)?.sectors ?? [])];
  if (isLandscapingOrSnow(job.title)) return sectors.filter((s) => !/construction/i.test(s));
  return sectors;
}

/** Id de région (référentiel) de l'employeur, dérivé de sa région administrative RBQ. */
export const employerRegionId = (sourceId?: string | null): string | undefined =>
  regionIdFromName(getEmployer(sourceId)?.region);

/**
 * Région effective d'une offre : sa région détectée depuis la localisation ;
 * à défaut, la région administrative (RBQ) du siège de l'employeur. C'est une
 * approximation raisonnable pour les entrepreneurs locaux (siège ≈ chantiers).
 */
export const effectiveRegionId = (job: {
  readonly regionId?: string | null;
  readonly sourceId?: string | null;
}): string | undefined => job.regionId ?? employerRegionId(job.sourceId);

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
