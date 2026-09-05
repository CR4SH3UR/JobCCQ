/**
 * Employeurs branchés sur un scraper personnalisé plutôt que sur le scraper
 * générique construit depuis leur méthode (`html`, `jobillico`, `zoho`...).
 *
 * La console admin s'en sert pour distinguer les scrapers sur mesure sans
 * importer le code serveur des scrapers.
 */
export const CUSTOM_SCRAPER_IDS = [
  "atwill-morin",
  "hamelconstruction-com",
  "pomerleau",
  "lafontaine",
  "ebc",
  "leqel",
  "beluga",
  "jmdemers",
  "cote-et-fils",
  "lefrancois",
  "jcdrolet",
  "refrabec",
  "amenagementgrenon-com",
  "guay",
  "cafortier",
  "canam",
  "groupe-canam-duplicate",
  "revenco",
  "lescharpentistes-com",
  "stefetmax-com",
  "droletconstruction-com",
  "electricitemc2-com",
  "glr",
  "excavationsrsr-com",
  "galilee",
  "intermat",
  "rioux",
  "atkinsrealis-com",
  "arteliagroup-com",
  "ascenseurs-absolu",
  "atelierenhauteur",
  "atlas-apex",
  "audetentrepreneurpeintre-com",
  "automationdrummond-com",
  "avivia-ca",
  "bardeaux-ca",
  "barettebernard-com",
  "qmb-ca",
  "gestionagodin-com",
  "baulne-ca",
  "berardtremblay-com",
] as const;

export type CustomScraperId = (typeof CUSTOM_SCRAPER_IDS)[number];

export const CUSTOM_SCRAPER_ID_SET: ReadonlySet<string> = new Set(CUSTOM_SCRAPER_IDS);

export function hasCustomScraper(sourceId?: string | null): boolean {
  return !!sourceId && CUSTOM_SCRAPER_ID_SET.has(sourceId);
}
