import { makeJsonLdScraper } from "./generic.js";

/**
 * Guichet-Emplois (Job Bank) — portail fédéral, couverture nationale.
 * Statut : expérimental (patron d'URL à valider contre le site réel).
 */
export const guichetEmploisScraper = makeJsonLdScraper({
  id: "guichet-emplois",
  defaultMaxPages: 3,
  buildUrl: (params, page) => {
    const kw = params.query ? encodeURIComponent(params.query) : "";
    const loc = params.location ? encodeURIComponent(params.location) : "Quebec";
    return `https://www.guichetemplois.gc.ca/jobsearch/jobsearch?searchstring=${kw}&locationstring=${loc}&page=${page}`;
  },
});
