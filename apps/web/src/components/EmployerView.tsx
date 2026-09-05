"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ccqTradeLabel, employerRegionId, getEmployer, labelForRegion, rbqLicenceUrl, similarEmployers, type HiringCompany, type Job } from "@jobccq/shared";
import { Badge } from "./Badge";
import { JobCard } from "./JobCard";
import { FollowEmployerButton } from "./FollowEmployerButton";
import { initials, timeAgo } from "@/lib/format";
import { getJobsBySource, invalidateJobsCache, searchCompanies, buildQuery } from "@/lib/data";
import { useLivePoll } from "@/lib/live";
import { organizationLd, ldJson } from "@/lib/jsonld";

export function EmployerView({ slug }: { slug: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [similar, setSimilar] = useState<HiringCompany[]>([]);

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

  // Rafraîchissement forcé : vide les caches (instantané, overlay, ville/région)
  // puis recharge les offres de cet employeur.
  const forceRefresh = useCallback(async () => {
    invalidateJobsCache();
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // Données enrichies dérivées des offres : logo réel, régions réellement
  // couvertes, dernière publication, métiers CCQ présents. Ces hooks doivent
  // rester AVANT tout `return` conditionnel (ordre des hooks stable).
  const logoUrl = jobs.find((j) => j.companyLogoUrl)?.companyLogoUrl;
  const careersUrl = employer?.careersUrl;
  const regionLabels = useMemo(() => {
    const ids = new Set<string>();
    if (employer?.region) ids.add(employer.region);
    for (const j of jobs) if (j.regionId) ids.add(j.regionId);
    return [...ids].map((id) => labelForRegion(id) ?? id);
  }, [jobs, employer?.region]);
  const lastPosted = useMemo(() => {
    const dates = jobs.map((j) => j.postedAt ?? j.scrapedAt).filter(Boolean) as string[];
    return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : undefined;
  }, [jobs]);
  const trades = useMemo(() => {
    const set = new Set<string>();
    for (const j of jobs) {
      const t = ccqTradeLabel(j.title);
      if (t) set.add(t);
    }
    return [...set].slice(0, 8);
  }, [jobs]);

  useEffect(() => {
    const current: HiringCompany = {
      company: name,
      openings: jobs.length,
      categories: [...new Set(jobs.map((j) => j.categoryId).filter((id): id is string => !!id))],
      regions: [
        ...new Set(
          [employerRegionId(slug), ...jobs.map((j) => j.regionId)].filter((id): id is string => !!id),
        ),
      ],
      sources: [slug],
    };
    let alive = true;
    searchCompanies(buildQuery({}))
      .then((r) => alive && setSimilar(similarEmployers(current, r.companies)))
      .catch(() => alive && setSimilar([]));
    return () => {
      alive = false;
    };
  }, [slug, name, jobs]);

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
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={name}
                className="h-16 w-16 shrink-0 rounded-xl object-contain ring-1 ring-slate-100"
              />
            ) : (
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-brand-50 text-lg font-bold text-brand-700 ring-1 ring-brand-100">
                {initials(name)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {name}
                {employer?.verified && (
                  <span className="ml-2 align-middle">
                    <Badge tone="green">Vérifié</Badge>
                  </span>
                )}
              </h1>
              <p className="mt-1 text-slate-600">
                {jobs.length} poste{jobs.length > 1 ? "s" : ""} ouvert{jobs.length > 1 ? "s" : ""}
                {lastPosted && timeAgo(lastPosted) ? ` · dernière offre ${timeAgo(lastPosted)}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {regionLabels.map((r) => (
                  <Badge key={r} tone="brand">
                    {r}
                  </Badge>
                ))}
                {employer?.rbq && (
                  <a href={rbqLicenceUrl(employer.rbq)} target="_blank" rel="noopener noreferrer">
                    <Badge>RBQ {employer.rbq} ↗</Badge>
                  </a>
                )}
                {sectors.map((s) => (
                  <Badge key={s} tone="amber">
                    {s}
                  </Badge>
                ))}
              </div>
              {trades.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-500">Métiers :</span>
                  {trades.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {careersUrl && (
                  <a
                    href={careersUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand-700 hover:underline"
                  >
                    Portail carrières ↗
                  </a>
                )}
                {employer?.homepage && (
                  <a
                    href={employer.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand-700 hover:underline"
                  >
                    Site web ↗
                  </a>
                )}
              </div>
              <div className="mt-4">
                <FollowEmployerButton slug={slug} name={name} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des offres */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold tracking-tight">Offres ouvertes</h2>
          <button
            type="button"
            onClick={forceRefresh}
            disabled={refreshing}
            title="Recharger les offres (vide le cache et récupère les derniers changements)"
            aria-label="Rafraîchir les offres"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <span className={refreshing ? "inline-block animate-spin" : "inline-block"}>↻</span>
            <span className="ml-1 hidden sm:inline">{refreshing ? "Rafraîchissement…" : "Rafraîchir"}</span>
          </button>
        </div>
        {jobs.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <p className="text-slate-500">Aucune offre ouverte pour le moment.</p>
        )}

        {similar.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-bold tracking-tight">Employeurs similaires</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((c) => {
                const href = c.sources[0] ? `/entreprises/${c.sources[0]}/` : "/entreprises";
                return (
                  <Link key={c.company} href={href} className="card flex flex-col p-4 hover:border-brand-200">
                    <h3 className="truncate font-semibold">{c.company}</h3>
                    <p className="text-sm text-brand-700">
                      {c.openings} poste{c.openings > 1 ? "s" : ""} ouvert{c.openings > 1 ? "s" : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.regions.slice(0, 2).map((r) => (
                        <Badge key={r}>{labelForRegion(r)}</Badge>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJson(organizationLd(slug, name)) }}
      />
    </div>
  );
}
