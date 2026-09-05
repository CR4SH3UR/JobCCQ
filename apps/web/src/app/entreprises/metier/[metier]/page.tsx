import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CCQ_TRADES } from "@jobccq/shared";
import { companiesByTrade, tradesWithCounts } from "@/lib/static-data";
import { SeoRankingPage } from "@/components/SeoRankingPage";
import { siteUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams(): { metier: string }[] {
  return tradesWithCounts().map((t) => ({ metier: t.id }));
}

function tradeLabel(id: string): string | undefined {
  return CCQ_TRADES.find((t) => t.id === id)?.label;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ metier: string }>;
}): Promise<Metadata> {
  const { metier } = await params;
  const label = tradeLabel(metier);
  if (!label) return { title: "Qui recrute — JobCCQc" };
  const n = companiesByTrade(metier).length;
  const title = `Qui recrute — ${label} | JobCCQc`;
  const description = `${n} entreprise${n > 1 ? "s" : ""} recrutent pour le métier ${label.toLowerCase()}. Classement par nombre de postes ouverts.`;
  const url = siteUrl(`/entreprises/metier/${metier}/`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function EntreprisesMetierPage({ params }: { params: Promise<{ metier: string }> }) {
  const { metier } = await params;
  const label = tradeLabel(metier);
  if (!label) notFound();

  const companies = companiesByTrade(metier);
  const related = tradesWithCounts()
    .filter((t) => t.id !== metier)
    .slice(0, 12)
    .map((t) => ({ href: `/entreprises/metier/${t.id}/`, label: t.label, count: t.count }));

  return (
    <SeoRankingPage
      title={`Qui recrute — ${label}`}
      intro={`Employeurs classés par nombre de postes ouverts pour le métier ${label.toLowerCase()}.`}
      companies={companies}
      exploreHref="/entreprises"
      relatedTitle="Autres métiers"
      related={related}
    />
  );
}
