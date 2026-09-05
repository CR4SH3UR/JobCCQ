"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getEmployer,
  labelForCategory,
  labelForEmployment,
  labelForLanguage,
  labelForRegion,
  labelForRemote,
  sectorsForJob,
  sourceName,
  rbqLicenceUrl,
  jobCompleteness,
  extractContacts,
  extractRequirements,
  extractBenefits,
  summarizeDescription,
  type Job,
} from "@jobccq/shared";
import { Badge } from "./Badge";
import { JobCard } from "./JobCard";
import { FavoriteButton } from "./FavoriteButton";
import { AppliedButton } from "./AppliedButton";
import { formatSalary, initials, timeAgo } from "@/lib/format";
import { getJobById, getSimilarJobs } from "@/lib/data";
import { mergeLiveJob } from "@/lib/merge-job";
import { useLivePoll } from "@/lib/live";
import { jobPostingLd, ldJson } from "@/lib/jsonld";
import { COMPARE_MAX, toggleCompare, useCompareIds, useIsCompared } from "@/lib/compare";

const REMOTE_TONE = { teletravail: "green", hybride: "violet", presentiel: "slate" } as const;

export function JobDetailView({ id, initialJob }: { id: string; initialJob?: Job | null }) {
  const [job, setJob] = useState<Job | null>(initialJob ?? null);
  const [similar, setSimilar] = useState<Job[]>([]);
  const [loading, setLoading] = useState(!initialJob);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const live = await getJobById(id);
      const merged = mergeLiveJob(initialJob, live);
      if (!merged) {
        setError(true);
        setLoading(false);
        return;
      }
      setJob(merged);
      setSimilar(await getSimilarJobs(merged));
      setError(false);
    } catch {
      if (!initialJob) setError(true);
    } finally {
      setLoading(false);
    }
  }, [id, initialJob]);

  useEffect(() => {
    load();
  }, [load]);

  useLivePoll(load);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-slate-500">Chargement de l’offre…</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-slate-500">Offre introuvable.</p>
        <Link href="/emplois" className="mt-2 inline-block text-brand-700 hover:underline">
          ← Retour aux offres
        </Link>
      </div>
    );
  }

  const employer = getEmployer(job.sourceId);
  const region = labelForRegion(job.regionId);
  const salary = formatSalary(job);
  const posted = timeAgo(job.postedAt ?? job.scrapedAt);
  const sectors = sectorsForJob(job);
  const languages = job.languages ?? [];
  const contacts = extractContacts(job.description);
  const requirements = extractRequirements(job.title, job.description);
  const benefits = extractBenefits(job.title, job.description);
  const summary = summarizeDescription(job.description);
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
                  {employer?.verified && (
                    <span className="ml-1.5 align-middle">
                      <Badge tone="green">Vérifié</Badge>
                    </span>
                  )}
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
            <CompletenessNote job={job} />

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
              <CompareDetailButton id={job.id} />
            </div>
          </div>

          {/* Description */}
          <div className="card mt-4 p-6">
            <h2 className="text-lg font-bold tracking-tight">Description du poste</h2>
            {summary.length > 0 && (
              <>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">En bref</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {summary.map((b) => (
                    <li key={b}>{b}.</li>
                  ))}
                </ul>
              </>
            )}
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

          {(requirements.length > 0 || benefits.length > 0) && (
            <div className="card mt-4 p-6">
              <h2 className="text-lg font-bold tracking-tight">Exigences et avantages</h2>
              <p className="mt-1 text-xs text-slate-500">
                Extrait de l'offre — à confirmer sur l'annonce originale.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {requirements.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">Exigences</h3>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {requirements.map((r) => (
                        <li key={r.id}>
                          <Badge>{r.label}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {benefits.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">Avantages</h3>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {benefits.map((b) => (
                        <li key={b.id}>
                          <Badge tone="green">{b.label}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {(contacts.emails.length > 0 || contacts.phones.length > 0) && (
            <div className="card mt-4 p-6">
              <h2 className="text-lg font-bold tracking-tight">Contact RH (public)</h2>
              <p className="mt-1 text-xs text-slate-500">
                Extrait de la description — à vérifier sur l'offre originale.
              </p>
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                {contacts.emails.map((e) => (
                  <li key={e}>
                    <a href={`mailto:${e}`} className="font-medium text-brand-700 hover:underline">
                      {e}
                    </a>
                  </li>
                ))}
                {contacts.phones.map((p) => (
                  <li key={p}>
                    <a href={`tel:${p.replace(/\D/g, "")}`} className="font-medium text-brand-700 hover:underline">
                      {p}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
                  <dd className="text-right font-medium">
                    <a
                      href={rbqLicenceUrl(employer.rbq)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-700 hover:underline"
                    >
                      {employer.rbq} ↗
                    </a>
                  </dd>
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

function CompareDetailButton({ id }: { id: string }) {
  const on = useIsCompared(id);
  const n = useCompareIds().length;
  const full = !on && n >= COMPARE_MAX;
  return (
    <button
      type="button"
      onClick={() => toggleCompare(id)}
      disabled={full}
      aria-pressed={on}
      className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {on ? "Dans la comparaison" : "Comparer"}
    </button>
  );
}

function CompletenessNote({ job }: { job: Job }) {
  const c = jobCompleteness(job);
  if (c.score === c.max) return null;
  return (
    <p className="mt-3 text-xs text-slate-500">
      Fiche {c.score}/{c.max} — manque {c.missing.join(", ")}.
    </p>
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
