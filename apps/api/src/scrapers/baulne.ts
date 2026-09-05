import { refineCareers } from "./careers.js";

/**
 * Baulne (mécanique du bâtiment / CVAC) — page carrières « accordéon ». Repli
 * générique + lieu par défaut (siège à Montréal) pour la détection de région.
 */
export const baulneScraper = refineCareers(
  {
    id: "baulne-ca",
    company: "Baulne",
    careersUrl: "https://www.baulne.ca/carriere-mecanique-du-batiment/",
  },
  { defaultLocation: "Montréal, QC" },
);
