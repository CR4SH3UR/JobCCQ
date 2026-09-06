"use client";

import Link from "next/link";
import {
  getEmployer,
  labelForCategory,
  labelForEmployment,
  labelForLanguage,
  labelForRegion,
  labelForRemote,
  sectorsForJob,
  ccqTradeLabel,
  ccqWageForJob,
  formatCcqHourly,
  sourceName,
  rbqLicenceUrl,
  jobCompleteness,
  jobDetailHref,
  type Job,
} from "@jobccq/shared";
import { Badge } from "./Badge";
import { MatchBadge } from "./MatchBadge";
import { AlsoOnBadge } from "./AlsoOnBadge";
import { cn, formatSalary, timeAgo } from "@/lib/format";
import { employerIsSponsored, jobIsPinned, useSponsorConfig } from "@/lib/sponsors-live";
import { toggleFavorite, useIsFavorite } from "@/lib/favorites";
import { toggleApplied, useHasApplied } from "@/lib/applications";
import { COMPARE_MAX, toggleCompare, useCompareIds, useIsCompared } from "@/lib/compare";
import { useLastApplyClickAt } from "@/lib/apply-clicks";
import { logoForJob } from "@/lib/logo-url";
import { CompanyAvatar } from "./CompanyAvatar";
import { ApplyLink } from "./ApplyLink";

const REMOTE_TONE = { teletravail: "green", hybride: "violet", presentiel: "slate" } as const;

export function JobCard({ job }: { job: Job }) {
  const salary = formatSalary(job);
  const region = labelForRegion(job.regionId);
  const posted = timeAgo(job.postedAt ?? job.scrapedAt);
  const sectors = sectorsForJob(job);
  const sponsorCfg = useSponsorConfig();
  const sponsored = employerIsSponsored(job.sourceId, sponsorCfg);
  const pinned = jobIsPinned(job.id, sponsorCfg);
  const applied = useHasApplied(job.id);
  const lastApplyClickAt = useLastApplyClickAt(job.id);
  const ccq = ccqTradeLabel(job.title);
  const ccqWage = ccqWageForJob(job.title);
  const employer = getEmployer(job.sourceId);
  const rbq = employer?.rbq;
  const verified = !!employer?.verified;
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
        // Offre déjà postulée : contour vert (prioritaire sur le liseré
        // « commandité » ambre). Sinon, liseré ambre pour les commandités.
        applied ? "ring-2 ring-green-400" : pinned ? "ring-2 ring-orange-400" : sponsored && "ring-2 ring-amber-300",
      )}
    >
      <div className="flex gap-3">
        <CompanyAvatar name={job.company} logo={logoForJob(job)} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold leading-snug">
              <Link href={jobDetailHref(job.id)} className="text-slate-900 hover:text-brand-700">
                {job.title}
              </Link>
            </h3>
            <div className="flex shrink-0 items-center gap-1.5">
              {posted && <span className="text-xs text-slate-400">{posted}</span>}
              <AppliedCheck id={job.id} />
              <CompareButton id={job.id} />
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
            {verified && (
              <span className="ml-1.5 align-middle">
                <Badge tone="green">Vérifié</Badge>
              </span>
            )}
            {place && <span className="text-slate-500"> · {place}</span>}
            {job.distanceKm != null && (
              <span className="text-slate-500"> · {job.distanceKm} km</span>
            )}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {applied && <Badge tone="green">✓ Postulé</Badge>}
            {lastApplyClickAt && <Badge tone="violet">Postuler ouvert {timeAgo(new Date(lastApplyClickAt).toISOString())}</Badge>}
            <MatchBadge job={job} />
            <AlsoOnBadge alts={job.alsoOn} />
            {job.linkStatus === "gone" && (
              <Badge tone="amber" title="Le lien original répond 404 ou redirige">
                Peut-être pourvue
              </Badge>
            )}
            {ccq && (
              <Badge
                tone="violet"
                title={
                  ccqWage
                    ? `Taux compagnon ICI : ${formatCcqHourly(ccqWage.hourly)}`
                    : "Métier reconnu CCQ (détection par intitulé)"
                }
              >
                {ccqWage ? `CCQ · ${formatCcqHourly(ccqWage.hourly)}` : "CCQ"}
              </Badge>
            )}
            {pinned && (
              <Badge tone="amber" title="Offre commanditée, épinglée en tête des résultats">
                ★ Épinglée
              </Badge>
            )}
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
            <p className="mt-2 line-clamp-4 text-sm text-slate-500">{job.description}</p>
          )}

          <div className="mt-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs text-slate-400">
              <CompletenessDots job={job} />
              <span>
                via {sourceName(job.sourceId)}
                {rbq && (
                  <>
                    {" · "}
                    <a
                      href={rbqLicenceUrl(rbq)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-slate-500 hover:text-brand-700 hover:underline"
                      title="Consulter cette licence au registre RBQ"
                      onClick={(e) => e.stopPropagation()}
                    >
                      RBQ {rbq}
                    </a>
                  </>
                )}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <ApplyLink
                job={job}
                className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Postuler
              </ApplyLink>
              <Link
                href={jobDetailHref(job.id)}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs font-semibold",
                  "bg-slate-100 text-slate-700 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-slate-800 dark:text-slate-200",
                )}
              >
                Détails →
              </Link>
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function CompletenessDots({ job }: { job: Job }) {
  const c = jobCompleteness(job);
  const title = c.missing.length ? `Manque : ${c.missing.join(", ")}` : "Fiche complète";
  return (
    <span
      title={title}
      aria-label={`Complétude ${c.score} sur ${c.max}`}
      className="inline-flex gap-0.5"
    >
      {Array.from({ length: c.max }, (_, i) => (
        <span
          key={i}
          className={cn("h-1.5 w-1.5 rounded-full", i < c.score ? "bg-brand-500" : "bg-slate-200")}
        />
      ))}
    </span>
  );
}

/** Marque l'offre pour le comparateur (max 3). */
function CompareButton({ id }: { id: string }) {
  const on = useIsCompared(id);
  const n = useCompareIds().length;
  const full = !on && n >= COMPARE_MAX;
  return (
    <button
      type="button"
      onClick={() => toggleCompare(id)}
      disabled={full}
      aria-pressed={on}
      aria-label={on ? "Retirer de la comparaison" : "Ajouter à la comparaison"}
      title={full ? `Déjà ${COMPARE_MAX} offres — retire-en une` : on ? "Retirer de la comparaison" : "Comparer (max 3)"}
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold leading-none transition-colors",
        on
          ? "bg-brand-100 text-brand-700 hover:bg-brand-200"
          : full
            ? "cursor-not-allowed text-slate-300"
            : "text-slate-300 hover:bg-slate-100 hover:text-brand-600",
      )}
    >
      ⚖
    </button>
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

