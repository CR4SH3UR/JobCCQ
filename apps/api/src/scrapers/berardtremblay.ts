import { refineCareers } from "./careers.js";

/**
 * Bérard Tremblay (arpenteurs-géomètres, Saint-Jean-sur-Richelieu) — page
 * carrières « accordéon ». On écarte le titre parasite = nom de l'entreprise
 * (capté par le repli « titres »), et on pose un lieu par défaut.
 */
export const berardTremblayScraper = refineCareers(
  {
    id: "berardtremblay-com",
    company: "Bérard Tremblay",
    careersUrl: "https://www.berardtremblay.com/carrieres/",
  },
  { drop: /^b[ée]rard\s+tremblay/i, defaultLocation: "Saint-Jean-sur-Richelieu, QC" },
);
