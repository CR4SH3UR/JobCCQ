import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";

/**
 * Plombier Expert (plombierexpert.ca) — plomberie résidentielle/commerciale.
 *
 * La page /carrieres/ ne publie pas de fiches de poste ouvertes : elle propose
 * uniquement un formulaire de candidature spontanée. Le scraper générique
 * capturait à tort des intitulés de service (« Plombier Commercial »,
 * « Plombier Résidentiel »…) présents dans le menu ou le contenu. On confirme
 * que la page est joignable, puis on renvoie explicitement 0 offre afin que la
 * synchronisation purge les éventuelles offres périmées.
 */
const CAREERS_URL = "https://plombierexpert.ca/carrieres/";

export const plombierExpertScraper: Scraper = {
  id: "plombierexpert-ca",
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(
      `plombierexpert-ca — page carrières : ${CAREERS_URL} (candidature spontanée, aucune offre)`,
    );
    try {
      // On confirme l'accessibilité avant de déclarer la source vide : un échec
      // réseau ne doit pas purger (on garderait l'état existant).
      await ctx.fetchHtml(CAREERS_URL);
    } catch (err) {
      ctx.log(`plombierexpert-ca — page inaccessible : ${(err as Error).message}`);
      return [];
    }
    ctx.markNoOpenings?.(false);
    return [];
  },
};
