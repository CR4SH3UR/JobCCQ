/**
 * Monétisation — commandites & employeurs en vedette.
 *
 * La configuration vit dans `apps/web/src/data/sponsors.json`, **éditable depuis
 * la console d'administration** (onglet « Sponsors » → publie le fichier sur
 * GitHub → redéploiement). Elle est intégrée au bundle au build, donc les
 * composants la lisent de façon synchrone (bannière, badge « Commandité », tri).
 *
 *  - `sponsors`     → bannière de commandite (logo + accroche + lien) ;
 *  - `featured`     → ids de sources mises en avant (offres épinglées + badge) ;
 *  - `contactEmail` → adresse affichée dans l'encart « Devenez commanditaire ».
 */
import config from "@/data/sponsors.json";

/** Niveau de commandite (détermine le placement et le style de la bannière). */
export type SponsorTier = "or" | "argent";

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
  /** Niveau : « or » (bannière vedette) ou « argent » (défaut). */
  readonly tier?: SponsorTier;
}

export interface SponsorConfig {
  readonly contactEmail: string;
  readonly sponsors: readonly Sponsor[];
  readonly featured: readonly string[];
}

/** Configuration brute (utile à la console d'administration comme état initial). */
export const SPONSOR_CONFIG: SponsorConfig = config as SponsorConfig;

/** Courriel de contact pour la vente d'espace publicitaire. */
export const SPONSOR_CONTACT_EMAIL = SPONSOR_CONFIG.contactEmail || "";

/** Commanditaires actifs affichés dans la bannière. */
export const SPONSORS: readonly Sponsor[] = SPONSOR_CONFIG.sponsors ?? [];

/** Employeurs « en vedette » (placement payant) — ids de source. */
export const SPONSORED_EMPLOYERS: ReadonlySet<string> = new Set(SPONSOR_CONFIG.featured ?? []);

/** Cet employeur est-il mis en avant ? */
export const isSponsoredEmployer = (sourceId?: string | null): boolean =>
  !!sourceId && SPONSORED_EMPLOYERS.has(sourceId);
