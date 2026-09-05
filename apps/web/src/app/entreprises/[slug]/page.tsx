import type { Metadata } from "next";
import { getEmployer, labelForRegion } from "@jobccq/shared";
import { employerIdsWithJobs, employerProfile } from "@/lib/static-data";
import { EmployerView } from "@/components/EmployerView";
import { siteUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return employerIdsWithJobs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = employerProfile(slug);
  if (!profile) return { title: "Employeur — JobCCQc" };
  const n = profile.jobs.length;
  const title = `Emplois chez ${profile.name} | JobCCQc`;
  const description = `${n} offre${n > 1 ? "s" : ""} d'emploi chez ${profile.name}${
    profile.employer?.rbq ? ` (RBQ ${profile.employer.rbq})` : ""
  }. Consultez les postes ouverts et postulez.`;
  const url = siteUrl(`/entreprises/${slug}/`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function EmployerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <EmployerView slug={slug} />;
}
