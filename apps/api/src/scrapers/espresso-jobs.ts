import { makeJsonLdScraper } from "./generic.js";

/**
 * Espresso-Jobs — emplois en technologies au Québec.
 * Statut : expérimental (patron d'URL à valider contre le site réel).
 */
export const espressoJobsScraper = makeJsonLdScraper({
  id: "espresso-jobs",
  defaultMaxPages: 3,
  buildUrl: (params, page) => {
    const kw = params.query ? encodeURIComponent(params.query) : "";
    return `https://www.espresso-jobs.com/emplois/?keyword=${kw}&page=${page}`;
  },
});
