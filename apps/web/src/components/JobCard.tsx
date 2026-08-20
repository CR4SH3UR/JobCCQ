import {
  labelForCategory,
  labelForEmployment,
  labelForRegion,
  labelForRemote,
  sourceName,
  type Job,
} from "@jobccq/shared";
import { Badge } from "./Badge";
import { cn, formatSalary, initials, timeAgo } from "@/lib/format";

const REMOTE_TONE = { teletravail: "green", hybride: "violet", presentiel: "slate" } as const;

export function JobCard({ job }: { job: Job }) {
  const salary = formatSalary(job);
  const region = labelForRegion(job.regionId);
  const posted = timeAgo(job.postedAt ?? job.scrapedAt);

  return (
    <article className="card group p-4 transition-shadow hover:shadow-md">
      <div className="flex gap-3">
        <Avatar name={job.company} logo={job.companyLogoUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold leading-snug">
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-900 hover:text-brand-700"
              >
                {job.title}
              </a>
            </h3>
            {posted && <span className="shrink-0 text-xs text-slate-400">{posted}</span>}
          </div>

          <p className="mt-0.5 text-sm text-slate-600">
            <span className="font-medium text-slate-800">{job.company}</span>
            {(job.city || region) && (
              <span className="text-slate-500"> · {job.city ?? region}</span>
            )}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {job.categoryId && <Badge tone="brand">{labelForCategory(job.categoryId)}</Badge>}
            {job.employmentType && <Badge>{labelForEmployment(job.employmentType)}</Badge>}
            {job.remote && (
              <Badge tone={REMOTE_TONE[job.remote]}>{labelForRemote(job.remote)}</Badge>
            )}
            {salary && <Badge tone="green">{salary}</Badge>}
          </div>

          {job.description && (
            <p className="mt-2 line-clamp-2 text-sm text-slate-500">{job.description}</p>
          )}

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">via {sourceName(job.sourceId)}</span>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-semibold",
                "bg-brand-600 text-white opacity-0 transition-opacity group-hover:opacity-100",
              )}
            >
              Voir l'offre →
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

function Avatar({ name, logo }: { name: string; logo?: string }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logo}
        alt={name}
        className="h-11 w-11 shrink-0 rounded-lg object-contain ring-1 ring-slate-200"
      />
    );
  }
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700 ring-1 ring-brand-100">
      {initials(name)}
    </span>
  );
}
