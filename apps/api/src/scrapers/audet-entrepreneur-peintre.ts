import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";

/**
 * Scraper dédié à Audet Entrepreneur Peintre inc. La page /carriere.html ne
 * contient AUCUNE offre : uniquement un formulaire de candidature spontanée et
 * les coordonnées de l'entreprise. Le repli générique captait par erreur
 * l'entrée « Peintre extérieur » du menu de navigation (une page de service,
 * pas un poste). On renvoie donc explicitement 0 offre, après avoir confirmé que
 * la page est joignable → la ligne fantôme est purgée à la synchronisation.
 */
const CAREERS = "https://www.audetentrepreneurpeintre.com/carriere.html";

export const audetEntrepreneurPeintreScraper: Scraper = {
  id: "audetentrepreneurpeintre-com",
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(
      `audetentrepreneurpeintre-com — page carrières : ${CAREERS} (candidature spontanée, aucune offre)`,
    );
    try {
      // On confirme l'accessibilité avant de déclarer la source vide : un échec
      // réseau ne doit pas purger (on garderait l'état existant).
      await ctx.fetchHtml(CAREERS);
    } catch (err) {
      ctx.log(`audetentrepreneurpeintre-com — page inaccessible : ${(err as Error).message}`);
      return [];
    }
    ctx.markNoOpenings?.(false);
    return [];
  },
};
