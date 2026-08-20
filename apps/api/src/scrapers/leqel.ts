import { makeCareersScraper } from "./careers.js";

/**
 * LEQEL / LEQEL Énergie — construction de lignes et de postes électriques
 * (réseau Hydro-Québec). Page carrières WordPress : les postes sont des liens
 * `/emploi-<slug>/` directement dans le HTML.
 */
export const leqelScraper = makeCareersScraper({
  id: "leqel",
  company: "LEQEL",
  careersUrl: "https://www.leqel.ca/carriere/",
  jobPathPattern: /\/emploi-/i,
});
