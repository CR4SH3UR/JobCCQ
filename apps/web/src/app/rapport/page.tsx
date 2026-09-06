import type { Metadata } from "next";
import Link from "next/link";
import { weeklyReport } from "@/lib/static-data";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Rapport hebdomadaire — JobCCQc",
  description:
    "Nouvelles offres d'emploi en construction au Québec sur 7 jours : volume, top employeurs, régions et métiers.",
  alternates: { canonical: siteUrl("/rapport/") },
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default function RapportPage() {
  const r = weeklyReport();
  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Rapport des {r.days} derniers jours</h1>
          <p className="mt-1 text-slate-600">
            {r.newJobs.toLocaleString("fr-CA")} nouvelle{r.newJobs > 1 ? "s" : ""} offre
            {r.newJobs > 1 ? "s" : ""} (sur {r.totalJobs.toLocaleString("fr-CA")} ouvertes). Mis à jour{" "}
            {formatWhen(r.generatedAt)}.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-6">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Top employeurs</h2>
          {r.topEmployers.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune nouvelle offre sur la période.</p>
          ) : (
            <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {r.topEmployers.map((e) => (
                <li key={e.id} className="flex justify-between gap-3 px-4 py-2 text-sm">
                  <Link href={`/entreprises/${e.id}/`} className="font-medium hover:text-brand-700">
                    {e.label}
                  </Link>
                  <span className="tabular-nums text-slate-500">{e.count}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="mb-3 text-lg font-semibold">Régions</h2>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
              {r.topRegions.map((x) => (
                <li key={x.id} className="flex justify-between px-4 py-2">
                  <Link href={`/emplois/region/${x.id}/`} className="hover:text-brand-700">
                    {x.label}
                  </Link>
                  <span className="tabular-nums text-slate-500">{x.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold">Métiers</h2>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
              {r.topTrades.map((x) => (
                <li key={x.id} className="flex justify-between px-4 py-2">
                  <Link href={`/emplois/metier/${x.id}/`} className="hover:text-brand-700">
                    {x.label}
                  </Link>
                  <span className="tabular-nums text-slate-500">{x.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <p className="text-sm text-slate-500">
          <Link href="/salaire/" className="font-medium text-brand-700 hover:underline">
            Guide salarial
          </Link>
          {" · "}
          <Link href="/marche/" className="font-medium text-brand-700 hover:underline">
            Marché
          </Link>
        </p>
      </div>
    </div>
  );
}
