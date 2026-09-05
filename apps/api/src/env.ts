// Valeur par défaut pour un démarrage « zéro configuration » en développement.
// (Le chemin est relatif au dossier apps/api, cwd des scripts npm du workspace.)
process.env.DATABASE_URL ||= "file:./dev.db";

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  HOST: process.env.HOST ?? "0.0.0.0",
  DATABASE_URL: process.env.DATABASE_URL,
  /** Base Turso (libSQL) partagée en prod. Vide = fichier SQLite local (dev). */
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL ?? "",
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ?? "",
  /** Rythme poli entre deux requêtes de scraping (ms). */
  SCRAPE_DELAY_MS: Number(process.env.SCRAPE_DELAY_MS ?? 1500),
  USER_AGENT:
    process.env.SCRAPE_USER_AGENT ??
    "JobCCQ/0.1 (+https://github.com/cr4sh3ur/jobccq) agrégateur d'emplois",

  // --- Proxy sortant optionnel (contourne les blocages par IP, ex. Jobillico
  // renvoie 403 depuis les IP de GitHub Actions). Vide = aucun proxy (défaut).
  /**
   * Endpoint proxy « fetch » (ex. un Cloudflare Worker). Deux formats acceptés :
   *  - gabarit avec `{url}` (et `{token}`) : `https://x.workers.dev/?url={url}&token={token}` ;
   *  - sinon on ajoute `?url=<cible>&token=<jeton>` automatiquement.
   */
  SCRAPE_PROXY_URL: process.env.SCRAPE_PROXY_URL ?? "",
  /** Jeton partagé avec le proxy (évite un relais ouvert). */
  SCRAPE_PROXY_TOKEN: process.env.SCRAPE_PROXY_TOKEN ?? "",
  /**
   * Hôtes toujours routés via le proxy (CSV). « * » ou vide = tous. Défaut :
   * Jobillico + quelques sites qui répondent 200 mais servent une page vide/de
   * défi aux IP de centre de données de CI (le repli automatique sur échec ne
   * les rattrape pas, la requête directe « réussissant » avec 0 offre). Les
   * blocages francs (connexion refusée/coupée / 403) sont, eux, rattrapés
   * automatiquement par le repli proxy de http.ts même sans être listés ici —
   * mais on peut tout de même en épingler un (ex. `ardecconstruction.com`, qui
   * renvoie 403 aux IP de CI) pour éviter la tentative directe qui échoue
   * d'abord et pollue les journaux, et fetcher directement via le proxy.
   */
  SCRAPE_PROXY_HOSTS:
    process.env.SCRAPE_PROXY_HOSTS ??
    "jobillico.com,desfor.com,alarme-bois-francs.com,ardecconstruction.com",
};
