/**
 * Monétisation — commandites & offres en vedette.
 *
 * Ce fichier est le SEUL endroit à éditer pour vendre de l'espace sur JobCCQ :
 *  1. `SPONSORS`            → bannière de commandite (logo + lien) ;
 *  2. `SPONSORED_EMPLOYERS` → employeurs « en vedette » (offres épinglées + badge) ;
 *  3. `SPONSOR_CONTACT_EMAIL` → courriel affiché dans l'encart « Devenez commanditaire ».
 *
 * Aucune base de données requise : c'est de la configuration statique, déployée
 * avec le site. Pour vendre une place, ajoute une entrée et redéploie.
 */

export interface Sponsor {
  readonly id: string;
  /** Nom de l'annonceur. */
  readonly name: string;
  /** Accroche courte (une phrase). */
  readonly tagline: string;
  /** Lien de destination (site de l'annonceur). */
  readonly url: string;
  /** Logo optionnel : URL ou data URI (le site étant statique, préfère un data URI). */
  readonly logoUrl?: string;
}

/** Courriel de contact pour la vente d'espace publicitaire. TODO: mets le tien. */
export const SPONSOR_CONTACT_EMAIL = "commandites@jobccq.ca";

/**
 * Commanditaires actifs affichés dans la bannière.
 * Laisse vide pour montrer l'encart « Votre publicité ici » (inventaire à vendre).
 */
export const SPONSORS: readonly Sponsor[] = [
  // Exemple :
  // {
  //   id: "acme-outils",
  //   name: "ACME Outils",
  //   tagline: "Outillage professionnel pour les chantiers du Québec",
  //   url: "https://acme.example",
  //   logoUrl: "https://…/logo.png",
  // },
];

/**
 * Employeurs « en vedette » (placement payant) : leurs offres remontent en tête
 * des résultats et portent un badge « Commandité ». Utilise l'`id` de la source
 * (voir packages/shared/src/sources.ts / discovered.json).
 */
export const SPONSORED_EMPLOYERS: ReadonlySet<string> = new Set([
  // "pomerleau",
]);

export const isSponsoredEmployer = (sourceId?: string | null): boolean =>
  !!sourceId && SPONSORED_EMPLOYERS.has(sourceId);
