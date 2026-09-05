import type { Metadata } from "next";
import { labelForRegion } from "@jobccq/shared";
import { jobById, allJobs } from "@/lib/static-data";
import { JobDetailView } from "@/components/JobDetailView";
import { siteUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams(): { id: string }[] {
  return allJobs().map((j) => ({ id: j.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const job = jobById(id);
  if (!job) return { title: "Offre — JobCCQc" };
  const region = labelForRegion(job.regionId);
  const title = `${job.title} — ${job.company}${region ? ` (${region})` : ""} | JobCCQc`;
  const description = job.description?.slice(0, 155) ??
    `Offre d'emploi ${job.title} chez ${job.company}${region ? ` en ${region}` : " au Québec"}. Détails et candidature sur JobCCQc.`;
  const url = siteUrl(`/emplois/${job.id}/`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobDetailView id={id} initialJob={jobById(id) ?? null} />;
}
