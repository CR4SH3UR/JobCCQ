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
  extractClosesAt,
  formatClosesAt,
  flagWeirdTitle,
  extractRequirements,
  extractBenefits,
  summarizeDescription,
  matchJobToProfile,
  ccqWageForJob,
  formatCcqHourly,
  CCQ_SALARY_URL,
  formatHistoryEvent,
  glossTitleToEn,
  type Job,
} from "@jobccq/shared";
import { Badge } from "./Badge";
import { JobCard } from "./JobCard";
import { MatchBadge } from "./MatchBadge";
import { AlsoOnBadge } from "./AlsoOnBadge";
import { FavoriteButton } from "./FavoriteButton";
import { AppliedButton } from "./AppliedButton";
import { ApplyLink } from "./ApplyLink";
import { ReportJobButton } from "./ReportJobButton";
import { formatSalary, timeAgo } from "@/lib/format";
import { getJobById, getSimilarJobs } from "@/lib/data";
import { mergeLiveJob } from "@/lib/merge-job";
import { useLivePoll } from "@/lib/live";
import { jobPostingLd, ldJson } from "@/lib/jsonld";
import { COMPARE_MAX, toggleCompare, useCompareIds, useIsCompared } from "@/lib/compare";
import { useProfile } from "@/lib/profile";
import { useLastApplyClickAt } from "@/lib/apply-clicks";
import { logoForJob } from "@/lib/logo-url";
import { recordJobView } from "@/lib/job-views";
import { CompanyAvatar } from "./CompanyAvatar";

const REMOTE_TONE = { teletravail: "green", hybride: "violet", presentiel: "slate" } as const;

export function JobDetailView({ id, initialJob }: { id: string; initialJob?: Job | null }) {
  const [job, setJob] = useState<Job | null>(initialJob ?? null);
  const [similar, setSimilar] = useState<Job[]>([]);
  const [loading, setLoading] = useState(!initialJob);
  const [error, setError] = useState(false);
  const [showEn, setShowEn] = useState(false);
  const lastApplyClickAt = useLastApplyClickAt(id);

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

  useEffect(() => {
    if (job) recordJobView({ id: job.id, sourceId: job.sourceId, title: job.title });
  }, [job]);

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
  const gloss = glossTitleToEn(job.title);
  const closesAt = job.closesAt ?? extractClosesAt(job.title, job.description);
  const weirdTitle = flagWeirdTitle(job.title);
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
              <CompanyAvatar name={job.company} logo={logoForJob(job)} size={56} />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {showEn && gloss.changed ? gloss.text : job.title}
                </h1>
                {gloss.changed && (
                  <button
                    type="button"
                    onClick={() => setShowEn((v) => !v)}
                    className="mt-1 text-xs font-medium text-brand-700 hover:underline"
                  >
                    {showEn ? "Afficher l'original" : "Traduction automatique (EN)"}
                  </button>
                )}
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
              {closesAt && (
                <Badge tone="amber" title={`Date limite extraite : ${closesAt}`}>
                  Ferme le {formatClosesAt(closesAt)}
                </Badge>
              )}
              {weirdTitle && (
                <Badge tone="amber" title={weirdTitle.label}>
                  Titre douteux
                </Badge>
              )}
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
              <MatchBadge job={job} />
              <AlsoOnBadge alts={job.alsoOn} />
            </div>
            {job.linkStatus === "gone" && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100">
                Lien original introuvable ou redirigé — cette offre est peut-être pourvue. Vérifie
                sur le site de l'employeur avant de postuler.
              </p>
            )}
            <CompletenessNote job={job} />
            <CcqWageNote job={job} />
            <MatchNote job={job} />
            {job.history && job.history.length > 0 && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Historique</p>
                <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
                  {job.history.slice().reverse().map((e, i) => (
                    <li key={`${e.at}-${i}`}>
                      {formatHistoryEvent(e)}
                      <span className="ml-1 text-xs text-slate-400">{timeAgo(e.at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <ApplyLink
                job={job}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
              >
                Postuler sur {sourceName(job.sourceId)} →
              </ApplyLink>
              <AppliedButton id={job.id} />
              <FavoriteButton id={job.id} />
              <CompareDetailButton id={job.id} />
              <ReportJobButton job={job} />
            </div>
            {lastApplyClickAt && (
              <p className="mt-2 text-xs text-slate-500">
                Tu as déjà ouvert le site de l'employeur {timeAgo(new Date(lastApplyClickAt).toISOString())}.
              </p>
            )}
            {job.alsoOn && job.alsoOn.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {job.alsoOn.map((a) => (
                  <li key={a.id}>
                    <ApplyLink
                      job={{ id: a.id, sourceId: a.sourceId, title: job.title, url: a.url }}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      Aussi sur {sourceName(a.sourceId)} ↗
                    </ApplyLink>
                  </li>
                ))}
              </ul>
            )}
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
                <ApplyLink job={job} className="font-medium text-brand-700 hover:underline">
                  Voir l'offre complète
                </ApplyLink>
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

function CcqWageNote({ job }: { job: Job }) {
  const w = ccqWageForJob(job.title, job);
  if (!w) return null;
  const vs =
    w.vsOffer === "below"
      ? "L'offre est sous ce taux compagnon."
      : w.vsOffer === "above"
        ? "L'offre est au-dessus de ce taux compagnon."
        : w.vsOffer === "near"
          ? "L'offre est proche de ce taux compagnon."
          : null;
  return (
    <p className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-100">
      Grille CCQ · {w.tradeLabel} compagnon ({w.sector}) :{" "}
      <span className="font-semibold">{formatCcqHourly(w.hourly)}</span>
      {vs ? ` — ${vs}` : ""}
      {w.isolatedNote
        ? " Taux majoré possible (chantiers isolés / Baie-James)."
        : ""}{" "}
      <a
        href={CCQ_SALARY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline decoration-violet-400/60 underline-offset-2 hover:decoration-violet-600"
      >
        Source CCQ
      </a>
      <span className="text-violet-700 dark:text-violet-200"> · 26 avr. 2026</span>
    </p>
  );
}

function MatchNote({ job }: { job: Job }) {
  const m = matchJobToProfile(job, useProfile());
  if (!m || m.score <= 0) return null;
  return (
    <p className="mt-1 text-xs text-slate-500">
      {m.score}&nbsp;% d'adéquation
      {m.reasons.length ? ` — ${m.reasons.join(" · ")}` : " — peu d'axes du profil collent"}.
    </p>
  );
}

