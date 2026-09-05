import type { Job } from "./types.js";

function xml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function pubDate(iso?: string): string {
  const t = iso ? Date.parse(iso) : NaN;
  const d = Number.isNaN(t) ? new Date() : new Date(t);
  return d.toUTCString();
}

/**
 * Flux RSS 2.0 d'un lot d'offres (recherche ou instantané complet).
 */
export function jobsToRss(
  jobs: Job[],
  opts: { siteUrl: string; feedUrl: string; title?: string; description?: string },
): string {
  const origin = opts.siteUrl.replace(/\/$/, "");
  const title = opts.title ?? "JobCCQc — offres d'emploi construction";
  const description =
    opts.description ?? "Offres d'emploi en construction et génie civil au Québec, agrégées chez les employeurs.";
  const items = jobs
    .slice()
    .sort((a, b) => Date.parse(b.postedAt ?? b.scrapedAt) - Date.parse(a.postedAt ?? a.scrapedAt))
    .slice(0, 50)
    .map((j) => {
      const link = `${origin}/emplois/${encodeURIComponent(j.id)}/`;
      const desc = j.description ? xml(j.description.slice(0, 400)) : xml(`${j.title} chez ${j.company}`);
      return `    <item>
      <title>${xml(`${j.title} — ${j.company}`)}</title>
      <link>${xml(link)}</link>
      <guid isPermaLink="true">${xml(link)}</guid>
      <pubDate>${pubDate(j.postedAt ?? j.scrapedAt)}</pubDate>
      <description>${desc}</description>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(title)}</title>
    <link>${xml(origin)}/</link>
    <description>${xml(description)}</description>
    <language>fr-ca</language>
    <atom:link href="${xml(opts.feedUrl)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}
