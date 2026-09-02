"use client";

import Link from "next/link";
import {
  getEmployer,
  getSource,
  labelForCategory,
  labelForEmployment,
  labelForLanguage,
  labelForRegion,
  labelForRemote,
  sourceName,
  type Job,
} from "@jobccq/shared";
import { Badge } from "./Badge";
import { cn, formatSalary, initials, timeAgo } from "@/lib/format";
import { isSponsoredEmployer } from "@/lib/sponsors";
import { toggleFavorite, useIsFavorite } from "@/lib/favorites";
import { toggleApplied, useHasApplied } from "@/lib/applications";

const REMOTE_TONE = { teletravail: "green", hybride: "violet", presentiel: "slate" } as const;

export function JobCard({ job }: { job: Job }) {
  const salary = formatSalary(job);
  const region = labelForRegion(job.regionId);
  const posted = timeAgo(job.postedAt ?? job.scrapedAt);
  const sectors = getSource(job.sourceId)?.sectors ?? [];
  const sponsored = isSponsoredEmployer(job.sourceId);
  const applied = useHasApplied(job.id);
  const rbq = getEmployer(job.sourceId)?.rbq;
  const languages = job.languages ?? [];
  // Lieu : ville, puis région administrative si elle apporte une précision.
  const place =
    job.city && region && !region.toLowerCase().includes(job.city.toLowerCase())
      ? `${job.city} · ${region}`
      : (job.city ?? region);

  return (
    <article
      className={cn(
        "card group p-4 transition-shadow hover:shadow-md",
        sponsored && "ring-2 ring-amber-300",
      )}
    >
      <div className="flex gap-3">
        <Avatar name={job.company} logo={job.companyLogoUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold leading-snug">
              <Link href={`/emplois/${job.id}/`} className="text-slate-900 hover:text-brand-700">
                {job.title}
              </Link>
            </h3>
            <div className="flex shrink-0 items-center gap-1.5">
              {posted && <span className="text-xs text-slate-400">{posted}</span>}
              <AppliedCheck id={job.id} />
              <FavButton id={job.id} />
            </div>
          </div>

          <p className="mt-0.5 text-sm text-slate-600">
            <Link
              href={`/entreprises/${job.sourceId}/`}
              className="font-medium text-slate-800 hover:text-brand-700"
            >
              {job.company}
            </Link>
            {place && <span className="text-slate-500"> · {place}</span>}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {applied && <Badge tone="green">✓ Postulé</Badge>}
            {sponsored && <Badge tone="amber">★ Commandité</Badge>}
            {job.categoryId && <Badge tone="brand">{labelForCategory(job.categoryId)}</Badge>}
            {sectors.slice(0, 2).map((s) => (
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

          {job.description && (
            <p className="mt-2 line-clamp-2 text-sm text-slate-500">{job.description}</p>
          )}

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              via {sourceName(job.sourceId)}
              {rbq && (
                <>
                  {" · "}
                  <span
                    className="font-medium text-slate-500"
                    title="Licence RBQ (indicatif — source : Données Québec)"
                  >
                    RBQ {rbq}
                  </span>
                </>
              )}
            </span>
            <Link
              href={`/emplois/${job.id}/`}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-semibold",
                "bg-brand-600 text-white opacity-0 transition-opacity group-hover:opacity-100",
              )}
            >
              Détails →
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Bouton cœur : ajoute/retire l'offre des favoris (stockés dans le navigateur). */
function FavButton({ id }: { id: string }) {
  const fav = useIsFavorite(id);
  return (
    <button
      type="button"
      onClick={() => toggleFavorite(id)}
      aria-pressed={fav}
      aria-label={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
      title={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-full text-lg leading-none transition-colors",
        fav
          ? "text-red-500 hover:bg-red-50"
          : "text-slate-300 hover:bg-slate-100 hover:text-red-400",
      )}
    >
      {fav ? "♥" : "♡"}
    </button>
  );
}

/** Crochet « postulé » : marque/retire l'offre de vos candidatures (crochet vert). */
function AppliedCheck({ id }: { id: string }) {
  const applied = useHasApplied(id);
  return (
    <button
      type="button"
      onClick={() => toggleApplied(id)}
      aria-pressed={applied}
      aria-label={applied ? "Retirer de mes candidatures" : "Marquer comme postulé"}
      title={applied ? "Retirer de mes candidatures" : "Marquer comme postulé"}
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold leading-none transition-colors",
        applied
          ? "bg-green-100 text-green-600 hover:bg-green-200"
          : "text-slate-300 hover:bg-slate-100 hover:text-green-500",
      )}
    >
      ✓
    </button>
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
