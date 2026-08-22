import type { MetadataRoute } from "next";
import { allJobs, employerIdsWithJobs } from "@/lib/static-data";
import { siteUrl } from "@/lib/site";

// Export statique : le sitemap est généré au build (fichier sitemap.xml).
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = [
    { url: siteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: siteUrl("/emplois/"), changeFrequency: "daily", priority: 0.9 },
    { url: siteUrl("/entreprises/"), changeFrequency: "weekly", priority: 0.7 },
    { url: siteUrl("/sources/"), changeFrequency: "monthly", priority: 0.3 },
    { url: siteUrl("/alertes/"), changeFrequency: "monthly", priority: 0.3 },
  ];

  const jobs: MetadataRoute.Sitemap = allJobs().map((j) => ({
    url: siteUrl(`/emplois/${j.id}/`),
    lastModified: j.postedAt ?? j.scrapedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const employers: MetadataRoute.Sitemap = employerIdsWithJobs().map((id) => ({
    url: siteUrl(`/entreprises/${id}/`),
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...pages, ...jobs, ...employers];
}
