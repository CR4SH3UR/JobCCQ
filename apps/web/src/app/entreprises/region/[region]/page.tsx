import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { labelForRegion, QUEBEC_REGIONS } from "@jobccq/shared";
import { companiesByRegion, regionsWithCounts } from "@/lib/static-data";
import { SeoRankingPage } from "@/components/SeoRankingPage";
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
  if (!label) return { title: "Qui recrute — JobCCQc" };
  const n = companiesByRegion(region).length;
  const title = `Qui recrute en ${label} | JobCCQc`;
  const description = `${n} entreprise${n > 1 ? "s" : ""} recrutent en construction et génie civil en ${label}. Classement par nombre de postes ouverts.`;
  const url = siteUrl(`/entreprises/region/${region}/`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function EntreprisesRegionPage({ params }: { params: Promise<{ region: string }> }) {
  const { region } = await params;
  const label = regionLabel(region);
  if (!label) notFound();

  const companies = companiesByRegion(region);
  const related = regionsWithCounts()
    .filter((r) => r.id !== region)
    .slice(0, 12)
    .map((r) => ({ href: `/entreprises/region/${r.id}/`, label: r.label, count: r.count }));

  return (
    <SeoRankingPage
      title={`Qui recrute en ${label}`}
      intro={`Employeurs de la construction et du génie civil classés par nombre de postes ouverts en ${label}.`}
      companies={companies}
      exploreHref={`/entreprises`}
      relatedTitle="Autres régions"
      related={related}
    />
  );
}
