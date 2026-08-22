/**
 * URL absolue du site (origine + basePath), pour les canoniques, le sitemap et
 * les données structurées JSON-LD — qui exigent des URL complètes.
 *
 * En prod (GitHub Pages) : origine = https://cr4sh3ur.github.io, basePath =
 * /JobCCQ. Surchargeable via NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_BASE_PATH.
 */
export const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://cr4sh3ur.github.io"
).replace(/\/$/, "");

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** URL absolue pour un chemin interne (ex. `/emplois/ab12/`). */
export const siteUrl = (path = "/"): string =>
  `${SITE_ORIGIN}${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
