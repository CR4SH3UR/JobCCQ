/**
 * Widget « nos offres » : URL et snippet iframe à coller sur le site
 * d'un employeur du répertoire.
 */
import { BASE_PATH, SITE_ORIGIN } from "./site";

/** Chemin interne du widget (avec slash final, comme le reste du site). */
export function embedPath(slug: string): string {
  const id = slug.trim();
  return `/embed/${encodeURIComponent(id)}/`;
}

/** URL absolue du widget. */
export function embedUrl(slug: string, origin = SITE_ORIGIN): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${BASE_PATH}${embedPath(slug)}`;
}

/** Snippet HTML à coller (iframe responsive). */
export function embedSnippet(slug: string, name?: string, origin = SITE_ORIGIN): string {
  const src = embedUrl(slug, origin);
  const title = name ? `Offres d'emploi — ${name}` : "Offres d'emploi";
  return `<iframe src="${src}" title="${title.replaceAll('"', "'")}" style="width:100%;min-height:28rem;border:0;border-radius:12px;" loading="lazy"></iframe>`;
}
