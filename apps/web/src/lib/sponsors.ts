/**
 * Monétisation — commandites & employeurs en vedette.
 *
 * La configuration vit dans `apps/web/src/data/sponsors.json`, **éditable depuis
 * la console d'administration** (onglet « Sponsors » → publie le fichier sur
 * GitHub → redéploiement). Elle est intégrée au bundle au build, donc les
 * composants la lisent de façon synchrone (bannière, badge « Commandité », tri).
 *
 *  - `sponsors`     → bannière de commandite (logo + accroche + lien) ;
 *  - `featured`     → ids de sources mises en avant (offres + badge) ;
 *  - `pinned`       → offres Bronze (tête de liste, 7 jours) ;
 *  - `contactEmail` → adresse affichée dans l'encart « Devenez commanditaire ».
 */
import config from "@/data/sponsors.json";
import {
  PINNED_MAX,
  activePinnedJobIds,
  parsePinnedList,
  type PinnedJob,
  type SponsorTier,
} from "./sponsors-parse.js";

export {
  PINNED_MAX,
  activePinnedJobIds,
  isPinnedActive,
  parsePinnedList,
  parseSponsorTier,
  pinJobsFirst,
  type PinnedJob,
  type SponsorTier,
} from "./sponsors-parse.js";

export interface Sponsor {
  readonly id: string;
  /** Nom de l'annonceur. */
  readonly name: string;
  /** Accroche courte (une phrase). */
  readonly tagline: string;
  /** Lien de destination (site de l'annonceur). */
  readonly url: string;
  /** Logo optionnel : URL ou data URI. */
  readonly logoUrl?: string;
  /** Niveau : or (vedette), argent (grille), bronze (bandeau compact). */
  readonly tier?: SponsorTier;
}

export interface SponsorConfig {
  readonly contactEmail: string;
  readonly sponsors: readonly Sponsor[];
  readonly featured: readonly string[];
  readonly pinned: readonly PinnedJob[];
}

/** Packs vendus sur `/commandite` (libellés + fourchettes). */
export const SPONSOR_PACKS = [
  {
    id: "argent" as const,
    name: "Argent",
    medal: "🥈",
    price: "150–300 $ / mois",
    blurb: "Carte compacte sur l'accueil et la recherche d'emplois.",
    includes: [
      "Bannière Argent (accueil + /emplois)",
      "Logo, accroche et lien",
      "Mention « Commandité » visible",
    ],
  },
  {
    id: "or" as const,
    name: "Or",
    medal: "🥇",
    price: "400–800 $ / mois",
    blurb: "Bannière vedette et vos postes mis en avant.",
    includes: [
      "Bannière Or rotative",
      "Employeur en vedette (carte accueil + badge)",
      "Remontée légère dans la liste",
    ],
  },
  {
    id: "bronze" as const,
    name: "Bronze",
    medal: "🥉",
    price: "200–400 $ / 7 jours",
    blurb: "Une offre précise épinglée en tête des résultats.",
    includes: [
      "1 offre épinglée (2 max. sur la page)",
      "Badge « Épinglée »",
      "Expiration automatique à la date choisie",
    ],
  },
] as const;

export type SponsorPackId = (typeof SPONSOR_PACKS)[number]["id"];

function readConfig(raw: unknown): SponsorConfig {
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const sponsors = Array.isArray(rec.sponsors)
    ? rec.sponsors.filter((s): s is Sponsor => !!s && typeof s === "object")
    : [];
  const featured = Array.isArray(rec.featured)
    ? rec.featured.filter((id): id is string => typeof id === "string" && !!id.trim())
    : [];
  return {
    contactEmail: typeof rec.contactEmail === "string" ? rec.contactEmail : "",
    sponsors,
    featured,
    pinned: parsePinnedList(rec.pinned),
  };
}

/** Configuration brute (utile à la console d'administration comme état initial). */
export const SPONSOR_CONFIG: SponsorConfig = readConfig(config);

/** Courriel de contact pour la vente d'espace publicitaire. */
export const SPONSOR_CONTACT_EMAIL = SPONSOR_CONFIG.contactEmail || "";

/** Commanditaires actifs affichés dans la bannière. */
export const SPONSORS: readonly Sponsor[] = SPONSOR_CONFIG.sponsors ?? [];

/** Employeurs « en vedette » (placement payant) — ids de source. */
export const SPONSORED_EMPLOYERS: ReadonlySet<string> = new Set(SPONSOR_CONFIG.featured ?? []);

/** Offres Bronze encore actives (ids). */
export const PINNED_JOB_IDS: readonly string[] = activePinnedJobIds(SPONSOR_CONFIG.pinned);

const PINNED_SET: ReadonlySet<string> = new Set(PINNED_JOB_IDS);

/** Cet employeur est-il mis en avant ? */
export const isSponsoredEmployer = (sourceId?: string | null): boolean =>
  !!sourceId && SPONSORED_EMPLOYERS.has(sourceId);

/** Cette offre est-elle épinglée (pack Bronze) ? */
export const isPinnedJob = (jobId?: string | null): boolean => !!jobId && PINNED_SET.has(jobId);
