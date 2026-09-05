"use client";

import { useCallback, useEffect, useState } from "react";
import { getEmployer, labelForRegion, type Job } from "@jobccq/shared";
import { getJobsBySource } from "@/lib/data";
import { formatSalary, timeAgo } from "@/lib/format";
import { siteUrl } from "@/lib/site";

/**
 * Vue compacte destinée à un iframe : offres d'un employeur, liens qui
 * s'ouvrent hors du cadre (site JobCCQc ou offre originale).
 */
export function EmbedView({ slug }: { slug: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const employer = getEmployer(slug);
  const name = employer?.name ?? jobs[0]?.company ?? slug;

  useEffect(() => {
    let alive = true;
    getJobsBySource(slug)
      .then((list) => alive && setJobs(list))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug]);

  return (
    <div className="mx-auto max-w-xl px-3 py-3">
      <header className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{name}</p>
          <p className="text-xs text-slate-500">
            {loading ? "Chargement…" : `${jobs.length} poste${jobs.length > 1 ? "s" : ""} ouvert${jobs.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <a
          href={siteUrl(`/entreprises/${slug}/`)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-semibold text-brand-600 hover:underline"
        >
          JobCCQc ↗
        </a>
      </header>

      {jobs.length === 0 && !loading && (
        <p className="py-6 text-center text-sm text-slate-500">Aucun poste ouvert pour le moment.</p>
      )}

      <ul className="space-y-2">
        {jobs.map((job) => (
          <li key={job.id}>
            <EmbedJobRow job={job} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmbedJobRow({ job }: { job: Job }) {
  const place = job.city ?? labelForRegion(job.regionId);
  const salary = formatSalary(job);
  const posted = timeAgo(job.postedAt ?? job.scrapedAt);
  const detail = siteUrl(`/emplois/${job.id}/`);

  const open = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3">
      <h2 className="text-sm font-semibold leading-snug text-slate-900">
        <a href={detail} target="_blank" rel="noopener noreferrer" className="hover:text-brand-700">
          {job.title}
        </a>
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">
        {[place, salary, posted].filter(Boolean).join(" · ")}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Postuler
        </a>
        <button
          type="button"
          onClick={() => open(detail)}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Détails
        </button>
      </div>
    </article>
  );
}
