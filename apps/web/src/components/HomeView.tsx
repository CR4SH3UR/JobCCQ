"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JOB_CATEGORIES, JOB_SOURCES, type HiringCompany } from "@jobccq/shared";
import { searchCompanies, getStats, buildQuery, type Stats } from "@/lib/data";
import { initials } from "@/lib/format";

export function HomeView() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [companies, setCompanies] = useState<HiringCompany[]>([]);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    Promise.all([getStats(), searchCompanies(buildQuery({}))])
      .then(([s, c]) => {
        setStats(s);
        setCompanies(c.companies.slice(0, 8));
      })
      .catch(() => setOffline(true));
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/emplois?q=${encodeURIComponent(q.trim())}` : "/emplois");
  };

  return (
    <div>
      {/* Héros */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Qui recrute au <span className="text-brand-600">Québec</span> ?
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            JobCCQ agrège les offres d'emploi de plusieurs sources québécoises et canadiennes.
            Trouvez quelles entreprises embauchent, pour quels postes, et filtrez comme vous voulez.
          </p>

          <form onSubmit={submit} className="mx-auto mt-8 flex max-w-xl gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ex. développeur, infirmière, électricien…"
              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <button
              type="submit"
              className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              Rechercher
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {JOB_CATEGORIES.slice(0, 8).map((c) => (
              <Link
                key={c.id}
                href={`/emplois?categories=${c.id}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Statistiques */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value={stats ? stats.totalJobs.toLocaleString("fr-CA") : "—"} label="Offres" />
          <Stat value={stats ? stats.totalCompanies.toLocaleString("fr-CA") : "—"} label="Entreprises" />
          <Stat value={String(JOB_SOURCES.length)} label="Sources répertoriées" />
          <Stat value={stats ? String(stats.byRegion.length) : "—"} label="Régions couvertes" />
        </div>

        {offline && (
          <div className="card mt-6 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            L'API n'est pas accessible. Démarre le back-end avec <code>npm run dev:api</code> puis
            peuple la base avec <code>npm run seed</code>.
          </div>
        )}
      </section>

      {/* Top des entreprises qui recrutent */}
      {companies.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-14">
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
                href="/entreprises"
                className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-md"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700 ring-1 ring-brand-100">
                  {initials(c.company)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.company}</p>
                  <p className="text-sm text-brand-700">
                    {c.openings} poste{c.openings > 1 ? "s" : ""}
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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-3xl font-extrabold text-brand-600">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}
