import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { labelForRegion, QUEBEC_REGIONS } from "@jobccq/shared";
import { jobsByRegion, regionsWithCounts } from "@/lib/static-data";
import { SeoResultsPage } from "@/components/SeoResultsPage";
import { siteUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams(): { region: string }[] {
  return regionsWithCounts().map((r) => ({ region: r.id }));
}

function regionLabel(id: string): string | undefined {
  return QUEBEC_REGIONS.some((r) => r.id === id) ? (labelForRegion(id) ?? id) : undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  const label = regionLabel(region);
  if (!label) return { title: "Région — JobCCQc" };
  const count = jobsByRegion(region).length;
  const title = `Emplois en construction — ${label} | JobCCQc`;
  const description = `${count} offre${count > 1 ? "s" : ""} d'emploi en construction et génie civil en ${label} (Québec), directement chez les employeurs. Recherche par métier, salaire et type de poste.`;
  const url = siteUrl(`/emplois/region/${region}/`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function RegionPage({ params }: { params: Promise<{ region: string }> }) {
  const { region } = await params;
  const label = regionLabel(region);
  if (!label) notFound();

  const jobs = jobsByRegion(region);
  const related = regionsWithCounts()
    .filter((r) => r.id !== region)
    .slice(0, 12)
    .map((r) => ({ href: `/emplois/region/${r.id}/`, label: r.label, count: r.count }));

  return (
    <SeoResultsPage
      title={`Emplois en construction en ${label}`}
      intro={`Postes ouverts en construction et génie civil en ${label}, agrégés directement depuis les portails carrières des employeurs.`}
      jobs={jobs}
      exploreHref={`/emplois/?regions=${region}`}
      relatedTitle="Autres régions"
      related={related}
    />
  );
}
