import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { labelForRegion } from "@jobccq/shared";
import { Badge } from "@/components/Badge";
import { JobCard } from "@/components/JobCard";
import { initials } from "@/lib/format";
import { employerIdsWithJobs, employerProfile } from "@/lib/static-data";
import { organizationLd, ldJson } from "@/lib/jsonld";
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
  if (!profile) return { title: "Employeur introuvable — JobCCQc" };
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
  const profile = employerProfile(slug);
  if (!profile) notFound();

  const { name, employer, jobs } = profile;
  const region = employer?.region;
  const sectors = employer?.sectors ?? [];

  return (
    <div>
      {/* En-tête employeur */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <nav className="mb-4 text-sm text-slate-500">
            <Link href="/entreprises" className="hover:text-brand-700">
              Qui recrute
            </Link>
            <span className="text-slate-400"> › {name}</span>
          </nav>
          <div className="flex items-start gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-brand-50 text-lg font-bold text-brand-700 ring-1 ring-brand-100">
              {initials(name)}
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{name}</h1>
              <p className="mt-1 text-slate-600">
                {jobs.length} poste{jobs.length > 1 ? "s" : ""} ouvert
                {jobs.length > 1 ? "s" : ""}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {region && <Badge tone="brand">{labelForRegion(region) ?? region}</Badge>}
                {employer?.rbq && <Badge>RBQ {employer.rbq}</Badge>}
                {sectors.map((s) => (
                  <Badge key={s} tone="amber">
                    {s}
                  </Badge>
                ))}
              </div>
              {employer?.homepage && (
                <a
                  href={employer.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline"
                >
                  Site web de l'entreprise ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Liste des offres */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="mb-4 text-xl font-bold tracking-tight">Offres ouvertes</h2>
        {jobs.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <p className="text-slate-500">Aucune offre ouverte pour le moment.</p>
        )}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJson(organizationLd(slug, name)) }}
      />
    </div>
  );
}
