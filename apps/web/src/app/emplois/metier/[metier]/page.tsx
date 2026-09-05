import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CCQ_TRADES } from "@jobccq/shared";
import { jobsByTrade, tradesWithCounts } from "@/lib/static-data";
import { SeoResultsPage } from "@/components/SeoResultsPage";
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
  if (!label) return { title: "Métier — JobCCQc" };
  const count = jobsByTrade(metier).length;
  const title = `Emplois ${label} au Québec | JobCCQc`;
  const description = `${count} offre${count > 1 ? "s" : ""} d'emploi de ${label.toLowerCase()} au Québec, directement chez les employeurs de la construction. Salaire, région et type de poste.`;
  const url = siteUrl(`/emplois/metier/${metier}/`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function MetierPage({ params }: { params: Promise<{ metier: string }> }) {
  const { metier } = await params;
  const label = tradeLabel(metier);
  if (!label) notFound();

  const jobs = jobsByTrade(metier);
  const related = tradesWithCounts()
    .filter((t) => t.id !== metier)
    .slice(0, 12)
    .map((t) => ({ href: `/emplois/metier/${t.id}/`, label: t.label, count: t.count }));

  return (
    <SeoResultsPage
      title={`Emplois : ${label}`}
      intro={`Postes de ${label.toLowerCase()} au Québec, agrégés directement depuis les portails carrières des employeurs de la construction.`}
      jobs={jobs}
      exploreHref={`/emplois/?q=${encodeURIComponent(label)}`}
      relatedTitle="Autres métiers"
      related={related}
    />
  );
}
