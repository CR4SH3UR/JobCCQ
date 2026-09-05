import { refineCareers } from "./careers.js";

/**
 * Barette Bernard (réfrigération / mécanique du bâtiment, Gatineau) — page
 * carrières « accordéon » (postes en sections ancrées). Repli générique + lieu
 * par défaut pour la détection de région.
 */
export const baretteBernardScraper = refineCareers(
  {
    id: "barettebernard-com",
    company: "Barette Bernard",
    careersUrl: "https://barettebernard.com/offre-demplois/",
  },
  { defaultLocation: "Gatineau, QC" },
);
