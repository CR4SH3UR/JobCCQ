import { makeCareersScraper } from "./careers.js";

/**
 * JM Demers Excavation — excavation, génie civil, béton.
 * Page carrières Wix : postes lus depuis le .wixui-repeater (repli sur les
 * liens si besoin).
 */
export const jmDemersScraper = makeCareersScraper({
  id: "jmdemers",
  company: "JM Demers Excavation",
  careersUrl: "https://www.jmdemers.com/carriere",
});
