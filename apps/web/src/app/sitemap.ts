import type { MetadataRoute } from "next";
import {
  allJobs,
  employerIdsWithJobs,
  regionsWithCounts,
  tradesWithCounts,
} from "@/lib/static-data";
import { siteUrl } from "@/lib/site";

// Export statique : le sitemap est généré au build (fichier sitemap.xml).
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = [
    { url: siteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: siteUrl("/emplois/"), changeFrequency: "daily", priority: 0.9 },
    { url: siteUrl("/marche/"), changeFrequency: "daily", priority: 0.7 },
    { url: siteUrl("/emplois/carte/"), changeFrequency: "daily", priority: 0.7 },
    { url: siteUrl("/emplois/region/"), changeFrequency: "weekly", priority: 0.6 },
    { url: siteUrl("/emplois/metier/"), changeFrequency: "weekly", priority: 0.6 },
    { url: siteUrl("/entreprises/"), changeFrequency: "weekly", priority: 0.7 },
    { url: siteUrl("/entreprises/pres-de-moi/"), changeFrequency: "weekly", priority: 0.65 },
    { url: siteUrl("/entreprises/region/"), changeFrequency: "weekly", priority: 0.6 },
    { url: siteUrl("/entreprises/metier/"), changeFrequency: "weekly", priority: 0.6 },
    { url: siteUrl("/sources/"), changeFrequency: "monthly", priority: 0.3 },
    { url: siteUrl("/alertes/"), changeFrequency: "monthly", priority: 0.3 },
    { url: siteUrl("/a-propos/"), changeFrequency: "monthly", priority: 0.3 },
    { url: siteUrl("/confidentialite/"), changeFrequency: "yearly", priority: 0.2 },
    { url: siteUrl("/conditions/"), changeFrequency: "yearly", priority: 0.2 },
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

  // Pages SEO par région et par métier (pré-générées).
  const regions: MetadataRoute.Sitemap = regionsWithCounts().map((r) => ({
    url: siteUrl(`/emplois/region/${r.id}/`),
    changeFrequency: "daily",
    priority: 0.6,
  }));
  const hiringRegions: MetadataRoute.Sitemap = regionsWithCounts().map((r) => ({
    url: siteUrl(`/entreprises/region/${r.id}/`),
    changeFrequency: "weekly",
    priority: 0.55,
  }));
  const trades: MetadataRoute.Sitemap = tradesWithCounts().map((t) => ({
    url: siteUrl(`/emplois/metier/${t.id}/`),
    changeFrequency: "daily",
    priority: 0.6,
  }));
  const hiringTrades: MetadataRoute.Sitemap = tradesWithCounts().map((t) => ({
    url: siteUrl(`/entreprises/metier/${t.id}/`),
    changeFrequency: "weekly",
    priority: 0.55,
  }));

  return [...pages, ...regions, ...hiringRegions, ...trades, ...hiringTrades, ...jobs, ...employers];
}
