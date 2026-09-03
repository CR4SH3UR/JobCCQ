import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getEmployer,
  labelForCategory,
  labelForEmployment,
  labelForLanguage,
  labelForRegion,
  labelForRemote,
  sectorsForJob,
  sourceName,
} from "@jobccq/shared";
import { Badge } from "@/components/Badge";
import { JobCard } from "@/components/JobCard";
import { FavoriteButton } from "@/components/FavoriteButton";
import { AppliedButton } from "@/components/AppliedButton";
import { formatSalary, initials, timeAgo } from "@/lib/format";
import { jobById, allJobs, similarJobs } from "@/lib/static-data";
import { jobPostingLd, ldJson } from "@/lib/jsonld";
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
  if (!job) return { title: "Offre introuvable — JobCCQc" };
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

const REMOTE_TONE = { teletravail: "green", hybride: "violet", presentiel: "slate" } as const;

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = jobById(id);
  if (!job) notFound();

  const employer = getEmployer(job.sourceId);
  const region = labelForRegion(job.regionId);
  const salary = formatSalary(job);
  const posted = timeAgo(job.postedAt ?? job.scrapedAt);
  const sectors = sectorsForJob(job);
  const languages = job.languages ?? [];
  const similar = similarJobs(job);
  const place =
    job.city && region && !region.toLowerCase().includes(job.city.toLowerCase())
      ? `${job.city} · ${region}`
      : (job.city ?? region);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Fil d'Ariane */}
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/emplois" className="hover:text-brand-700">
          Emplois
        </Link>
        {region && (
          <>
            {" › "}
            <Link href={`/emplois?regions=${job.regionId}`} className="hover:text-brand-700">
              {region}
            </Link>
          </>
        )}
        <span className="text-slate-400"> › {job.title}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Colonne principale */}
        <div className="min-w-0">
          <div className="card p-6">
            <div className="flex gap-4">
              <Avatar name={job.company} logo={job.companyLogoUrl} />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{job.title}</h1>
                <p className="mt-1 text-slate-600">
                  <Link
                    href={`/entreprises/${job.sourceId}/`}
                    className="font-medium text-slate-800 hover:text-brand-700"
                  >
                    {job.company}
                  </Link>
                  {place && <span className="text-slate-500"> · {place}</span>}
                </p>
                {posted && <p className="mt-0.5 text-sm text-slate-400">Publiée {posted}</p>}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {job.categoryId && <Badge tone="brand">{labelForCategory(job.categoryId)}</Badge>}
              {sectors.slice(0, 3).map((s) => (
                <Badge key={s} tone="amber">
                  {s}
                </Badge>
              ))}
              {job.employmentType && <Badge>{labelForEmployment(job.employmentType)}</Badge>}
              {job.remote && (
                <Badge tone={REMOTE_TONE[job.remote]}>{labelForRemote(job.remote)}</Badge>
              )}
              {salary && <Badge tone="green">{salary}</Badge>}
              {languages.map((l) => (
                <Badge key={l}>{labelForLanguage(l)}</Badge>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
              >
                Postuler sur {sourceName(job.sourceId)} →
              </a>
              <AppliedButton id={job.id} />
              <FavoriteButton id={job.id} />
            </div>
          </div>

          {/* Description */}
          <div className="card mt-4 p-6">
            <h2 className="text-lg font-bold tracking-tight">Description du poste</h2>
            {job.description ? (
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {job.description}
              </p>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Le résumé complet de cette offre est disponible sur le site de la source.{" "}
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand-700 hover:underline"
                >
                  Voir l'offre complète
                </a>
                .
              </p>
            )}
          </div>
        </div>

        {/* Colonne latérale — employeur */}
        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              L'employeur
            </h2>
            <Link
              href={`/entreprises/${job.sourceId}/`}
              className="mt-2 block font-semibold text-slate-900 hover:text-brand-700"
            >
              {job.company}
            </Link>
            <dl className="mt-3 space-y-1.5 text-sm text-slate-600">
              {(employer?.region ?? region) && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Région{employer?.region ? " (siège)" : ""}</dt>
                  <dd className="text-right font-medium">{employer?.region ?? region}</dd>
                </div>
              )}
              {employer?.rbq && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Licence RBQ</dt>
                  <dd className="text-right font-medium">{employer.rbq}</dd>
                </div>
              )}
              {sectors.length > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Secteurs</dt>
                  <dd className="text-right font-medium">{sectors.join(", ")}</dd>
                </div>
              )}
            </dl>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href={`/entreprises/${job.sourceId}/`}
                className="rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                Toutes les offres de {job.company}
              </Link>
              {employer?.homepage && (
                <a
                  href={employer.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-center text-sm text-slate-500 hover:text-brand-700"
                >
                  Site web ↗
                </a>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Offres similaires */}
      {similar.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold tracking-tight">Offres similaires</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {similar.map((s) => (
              <JobCard key={s.id} job={s} />
            ))}
          </div>
        </section>
      )}

      {/* Données structurées Google for Jobs */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJson(jobPostingLd(job)) }}
      />
    </div>
  );
}

function Avatar({ name, logo }: { name: string; logo?: string }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logo}
        alt={name}
        className="h-14 w-14 shrink-0 rounded-lg object-contain ring-1 ring-slate-200"
      />
    );
  }
  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-brand-50 text-base font-bold text-brand-700 ring-1 ring-brand-100">
      {initials(name)}
    </span>
  );
}
