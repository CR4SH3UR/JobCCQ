import type { RawJob } from "@jobccq/shared";

export interface ScrapeParams {
  /** Mot-clé de recherche (ex. "développeur"). */
  query?: string;
  /** Localisation (ex. "Montréal"). */
  location?: string;
  /** Nombre max de pages de résultats à parcourir. */
  maxPages?: number;
}

export interface ScrapeContext {
  /**
   * Récupère le HTML d'une URL (avec User-Agent, throttling et retry).
   * `opts.userAgent` permet de forcer un UA (certains ATS bloquent les UA bot).
   */
  fetchHtml(url: string, opts?: { userAgent?: string }): Promise<string>;
  log(message: string): void;
  /**
   * Signale que la page carrières a été **récupérée** (site joignable) mais ne
   * contient **aucune offre** → la synchro peut purger les offres périmées (au
   * lieu de conserver l'ancien état comme sur un échec/blocage réseau).
   * `explicit` = la page le **déclare** noir sur blanc (« aucune offre en ce
   * moment ») : purge quelle que soit la taille de la source ; sinon (page
   * réelle mais 0 offre), la synchro ne purge que les petites sources.
   */
  markNoOpenings?(explicit?: boolean): void;
}

/**
 * Contrat que chaque source doit implémenter.
 * `id` doit correspondre à une entrée du répertoire (packages/shared/src/sources.ts).
 */
export interface Scraper {
  readonly id: string;
  scrape(params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]>;
  /**
   * Parseur pur d'une page de résultats — sans réseau, donc testable hors-ligne
   * avec une fixture HTML. Optionnel mais recommandé.
   */
  parseList?(html: string, baseUrl: string): RawJob[];
}
