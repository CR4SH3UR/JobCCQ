import type { Metadata } from "next";
import { getEmployer } from "@jobccq/shared";
import { employerIdsWithJobs } from "@/lib/static-data";
import { EmbedView } from "@/components/EmbedView";
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
  const name = getEmployer(slug)?.name ?? slug;
  return {
    title: `Offres — ${name}`,
    robots: { index: false, follow: true },
    alternates: { canonical: siteUrl(`/entreprises/${slug}/`) },
  };
}

export default async function EmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <EmbedView slug={slug} />;
}
