"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getEmployer,
  labelForCategory,
  labelForRegion,
  profileIsSet,
  rankJobsByProfile,
  type HiringCompany,
  type Job,
} from "@jobccq/shared";
import { searchCompanies, searchJobs, getStats, buildQuery, type Stats } from "@/lib/data";
import { useLivePoll } from "@/lib/live";
import { SPONSORED_EMPLOYERS } from "@/lib/sponsors";
import { initials } from "@/lib/format";
import { JobCard } from "./JobCard";
import { SponsorBanner } from "./SponsorBanner";
import { OnboardingCard } from "./OnboardingCard";
import { useProfile } from "@/lib/profile";
import { filtersToQueryString, profileToFilters } from "@/lib/search-url";

/** Régions « fourre-tout » à ne pas proposer comme raccourci de navigation. */
const SKIP_REGIONS = new Set(["autre", "canada-autre", "teletravail", ""]);

export function HomeView() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [companies, setCompanies] = useState<HiringCompany[]>([]);
  const [latest, setLatest] = useState<Job[]>([]);
  const [forYou, setForYou] = useState<Job[]>([]);
  const [offline, setOffline] = useState(false);
  const profile = useProfile();

  const load = useCallback(() => {
    const personalized = profileIsSet(profile);
    Promise.all([
      getStats(),
      searchCompanies(buildQuery({})),
      searchJobs(buildQuery({ sort: "recent", pageSize: 6 })),
      personalized
        ? searchJobs(
            buildQuery({
              trades: profile.trades.length ? profile.trades : undefined,
              regions: profile.regions.length ? profile.regions : undefined,
              remote: profile.remote.length ? profile.remote : undefined,
              sort: "recent",
              pageSize: 40,
            }),
          )
        : Promise.resolve(null),
    ])
      .then(([s, c, j, mine]) => {
        setStats(s);
        setCompanies(c.companies.slice(0, 8));
        setLatest(j.items.slice(0, 6));
        setForYou(mine ? rankJobsByProfile(mine.items, profile).slice(0, 6) : []);
      })
      .catch(() => setOffline(true));
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  useLivePoll(load);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/emplois?q=${encodeURIComponent(q.trim())}` : "/emplois");
  };

  const realCategories = (stats?.byCategory ?? []).filter((c) => c.id && c.id !== "autre");
  const topCategories = [...realCategories].sort((a, b) => b.count - a.count).slice(0, 8);
  const realRegions = (stats?.byRegion ?? []).filter((r) => !SKIP_REGIONS.has(r.id));
  const topRegions = [...realRegions].sort((a, b) => b.count - a.count).slice(0, 8);

  // Employeurs en vedette (commandités) : mis en avant tout en haut.
  const bySource = new Map((stats?.bySource ?? []).map((s) => [s.id, s.count]));
  const featured = [...SPONSORED_EMPLOYERS]
    .map((id) => ({ id, employer: getEmployer(id), count: bySource.get(id) ?? 0 }))
    .filter((f) => f.employer || f.count > 0);

  return (
    <div>
      {/* Héros */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-brand-50 to-white">
        {/* Halos décoratifs (marque vive, subtils dans les deux thèmes) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-medium text-brand-700 shadow-sm backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Le portail de la construction et des métiers au Québec
          </span>

          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Qui recrute au <span className="text-brand-600">Québec</span> ?
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            JobCCQc regroupe les offres d'emploi de centaines d'entreprises québécoises. Trouvez qui
            embauche, pour quels postes, et postulez directement à la source.
          </p>

          <form onSubmit={submit} className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                🔎
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ex. charpentier, électricien, estimateur…"
                aria-label="Rechercher un poste"
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              Rechercher
            </button>
          </form>

          {/* Ligne de confiance (chiffres réels) */}
          {stats && (
            <p className="mt-4 text-sm text-slate-500">
              <span className="font-semibold text-slate-700">
                {stats.totalJobs.toLocaleString("fr-CA")}
              </span>{" "}
              offres ·{" "}
              <span className="font-semibold text-slate-700">
                {stats.totalCompanies.toLocaleString("fr-CA")}
              </span>{" "}
              entreprises · mises à jour chaque semaine
            </p>
          )}

          {/* Raccourcis par domaine (dynamiques, avec compte) */}
          {topCategories.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {topCategories.map((c) => (
                <Link
                  key={c.id}
                  href={`/emplois?categories=${c.id}`}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  {labelForCategory(c.id) ?? c.id}
                  <span className="ml-1 text-slate-400">{c.count}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <OnboardingCard />

      {/* Statistiques */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon="📋" value={stats ? stats.totalJobs.toLocaleString("fr-CA") : "—"} label="Offres en ligne" />
          <Stat icon="🏗️" value={stats ? stats.totalCompanies.toLocaleString("fr-CA") : "—"} label="Entreprises" />
          <Stat icon="📍" value={stats ? String(realRegions.length) : "—"} label="Régions couvertes" />
          <Stat icon="🧰" value={stats ? String(realCategories.length) : "—"} label="Domaines" />
        </div>

        {offline && (
          <div className="card mt-6 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            L'API n'est pas accessible. Démarre le back-end avec <code>npm run dev:api</code> puis
            peuple la base avec <code>npm run seed</code>.
          </div>
        )}

        <SponsorBanner className="mt-6" />
      </section>

      {/* Employeurs en vedette (commandités) */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-4">
          <h2 className="mb-4 text-xl font-bold tracking-tight">★ Employeurs en vedette</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((f) => {
              const name = f.employer?.name ?? f.id;
              return (
                <Link
                  key={f.id}
                  href={`/entreprises/${f.id}/`}
                  className="group relative overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/60 to-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <span className="absolute right-0 top-0 rounded-bl-lg bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
                    En vedette
                  </span>
                  <div className="flex items-center gap-3 pr-16">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700 ring-1 ring-brand-100">
                      {initials(name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900 group-hover:text-brand-700">
                        {name}
                      </p>
                      <p className="text-sm text-brand-700">
                        {f.count} poste{f.count > 1 ? "s" : ""} ouvert{f.count > 1 ? "s" : ""}
                      </p>
                      {f.employer?.region && (
                        <p className="truncate text-xs text-slate-500">{f.employer.region}</p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Offres pour le profil visiteur */}
      {forYou.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-4">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-bold tracking-tight">Pour toi</h2>
            <Link
              href={`/emplois?${filtersToQueryString(profileToFilters(profile))}`}
              className="text-sm font-semibold text-brand-600 hover:underline"
            >
              Voir toutes →
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {forYou.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}

      {/* Dernières offres */}
      {latest.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-4">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-bold tracking-tight">Dernières offres publiées</h2>
            <Link href="/emplois" className="text-sm font-semibold text-brand-600 hover:underline">
              Toutes les offres →
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {latest.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}

      {/* Explorer par région */}
      {topRegions.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="mb-4 text-xl font-bold tracking-tight">Explorez par région</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {topRegions.map((r) => (
              <Link
                key={r.id}
                href={`/emplois?regions=${r.id}`}
                className="card flex items-center justify-between p-4 transition-shadow hover:shadow-md"
              >
                <span className="min-w-0 truncate font-medium text-slate-800">
                  {labelForRegion(r.id) ?? r.id}
                </span>
                <span className="ml-2 shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
                  {r.count}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Top des entreprises qui recrutent */}
      {companies.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-bold tracking-tight">Elles recrutent en ce moment</h2>
            <Link href="/entreprises" className="text-sm font-semibold text-brand-600 hover:underline">
              Tout voir →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {companies.map((c) => (
              <Link
                key={c.company}
                href={
                  c.sources.length === 1
                    ? `/entreprises/${c.sources[0]}/`
                    : `/emplois?q=${encodeURIComponent(c.company)}`
                }
                className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-md"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700 ring-1 ring-brand-100">
                  {initials(c.company)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.company}</p>
                  <p className="text-sm text-brand-700">
                    {c.openings} poste{c.openings > 1 ? "s" : ""} ouvert{c.openings > 1 ? "s" : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="card p-4 text-center">
      <div className="text-lg" aria-hidden>
        {icon}
      </div>
      <p className="mt-1 text-3xl font-extrabold text-brand-600">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}
