import { makeCareersScraper } from "./careers.js";

/**
 * JC Drolet — génie civil, excavation, déneigement.
 * Page carrières WordPress : postes lus depuis les intitulés (repli « titres »).
 */
export const jcDroletScraper = makeCareersScraper({
  id: "jcdrolet",
  company: "JC Drolet",
  careersUrl: "https://jcdrolet.com/carrieres/",
});
