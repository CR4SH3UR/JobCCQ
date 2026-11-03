import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SEO_CITIES } from "@jobccq/shared";
import { citiesWithCounts, cityById, jobsByCity } from "@/lib/static-data";
import { SeoResultsPage } from "@/components/SeoResultsPage";
import { siteUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams(): { ville: string }[] {
  // Toujours pré-générer les villes SEO (même à 0 offre) : intention de
  // recherche forte ; le contenu indexable reste utile.
  const withJobs = new Set(citiesWithCounts().map((c) => c.id));
  return SEO_CITIES.map((c) => ({ ville: c.id })).filter(
    (p) => withJobs.has(p.ville) || ["laval", "gatineau", "levis", "sherbrooke"].includes(p.ville),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ville: string }>;
}): Promise<Metadata> {
  const { ville } = await params;
  const city = cityById(ville);
  if (!city) return { title: "Ville — JobCCQc" };
  const count = jobsByCity(ville).length;
  const title = `Emplois en construction à ${city.label} | JobCCQc`;
  const description = `${count} offre${count > 1 ? "s" : ""} d'emploi en construction et génie civil à ${city.label} (Québec), directement chez les employeurs. Salaire, métier et type de poste.`;
  const url = siteUrl(`/emplois/ville/${ville}/`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function VillePage({ params }: { params: Promise<{ ville: string }> }) {
  const { ville } = await params;
  const city = cityById(ville);
  if (!city) notFound();

  const jobs = jobsByCity(ville);
  const related = citiesWithCounts()
    .filter((c) => c.id !== ville)
    .slice(0, 12)
    .map((c) => ({ href: `/emplois/ville/${c.id}/`, label: c.label, count: c.count }));

  return (
    <SeoResultsPage
      title={`Emplois en construction à ${city.label}`}
      intro={`Postes ouverts en construction et génie civil à ${city.label}, agrégés directement depuis les portails carrières des employeurs.`}
      jobs={jobs}
      exploreHref={`/emplois/?cities=${encodeURIComponent(city.label)}`}
      relatedTitle="Autres villes"
      related={related}
    />
  );
}
