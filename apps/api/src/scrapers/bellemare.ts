import { makeNjoynScraper } from "./njoyn.js";

/**
 * Groupe Bellemare (matériaux, transport, grues — Trois-Rivières) : portail
 * carrières **Njoyn**. On utilise l'URL « joblisting » sans jeton de session
 * (les tbtoken/chk expirent). Nécessite le proxy sortant (anti-robot Radware).
 */
export const bellemareScraper = makeNjoynScraper({
  id: "bellemare-njoyn",
  company: "Groupe Bellemare",
  listUrl: "https://bellemare.njoyn.com/cl3/xweb/Xweb.asp?page=joblisting&CLID=53428&lang=2",
  defaultLocation: "Trois-Rivières, QC",
});
