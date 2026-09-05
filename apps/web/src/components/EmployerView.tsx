"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getEmployer, labelForRegion, type Job } from "@jobccq/shared";
import { Badge } from "./Badge";
import { JobCard } from "./JobCard";
import { initials } from "@/lib/format";
import { getJobsBySource } from "@/lib/data";
import { useLivePoll } from "@/lib/live";
import { organizationLd, ldJson } from "@/lib/jsonld";

export function EmployerView({ slug }: { slug: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const employer = getEmployer(slug);
  const name = employer?.name ?? jobs[0]?.company ?? slug;

  const load = useCallback(async () => {
    try {
      const list = await getJobsBySource(slug);
      setJobs(list);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  useLivePoll(load);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-slate-500">Chargement de l’employeur…</p>
      </div>
    );
  }

  if (error || (jobs.length === 0 && !employer)) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-slate-500">Employeur introuvable.</p>
        <Link href="/entreprises" className="mt-2 inline-block text-brand-700 hover:underline">
          ← Retour aux entreprises
        </Link>
      </div>
    );
  }

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
