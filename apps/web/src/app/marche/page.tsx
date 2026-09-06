import type { Metadata } from "next";
import Link from "next/link";
import {
  marketHistory,
  marketOverview,
  regionsWithCounts,
  tradesWithCounts,
  tradeTension,
  type FacetLink,
} from "@/lib/static-data";
import { MarketTrendChart } from "@/components/MarketTrendChart";
import { siteUrl } from "@/lib/site";
import { CCQ_WORKFORCE_SOURCE } from "@jobccq/shared";

export const metadata: Metadata = {
  title: "Marché de la construction au Québec — JobCCQc",
  description:
    "Tableau de bord du marché de l'emploi en construction et génie civil au Québec : évolution des offres, répartition par région et par métier, baromètre de tension.",
  alternates: { canonical: siteUrl("/marche/") },
};

/** Liste de barres horizontales (label + volume), largeur proportionnelle au max. */
function BarList({
  rows,
  href,
  max,
}: {
  rows: FacetLink[];
  href: (id: string) => string;
  max: number;
}) {
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={href(r.id)} className="group block">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium group-hover:text-brand-700">{r.label}</span>
              <span className="tabular-nums text-slate-500">{r.count}</span>
            </div>
            <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-500/80 group-hover:bg-brand-600"
                style={{ width: `${Math.max(3, Math.round((r.count / max) * 100))}%` }}
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function MarketPage() {
  const overview = marketOverview();
  const history = marketHistory(30);
  const regions = regionsWithCounts().slice(0, 12);
  const trades = tradesWithCounts().slice(0, 15);
  const tension = tradeTension().slice(0, 15);
  const regionMax = regions[0]?.count ?? 1;
  const tradeMax = trades[0]?.count ?? 1;
  const hasTension = tension.some((t) => t.tension != null);

  const kpis = [
    { label: "Offres ouvertes", value: overview.jobs },
    { label: "Employeurs qui recrutent", value: overview.employers },
    { label: "Régions actives", value: overview.regions },
    { label: "Métiers CCQ", value: overview.trades },
  ];

  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Marché de la construction au Québec</h1>
          <p className="mt-1 text-slate-600">
            Vue d'ensemble des offres agrégées : évolution dans le temps, répartition par région et
            par métier, et tension par métier.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-6">
        {/* Chiffres clés */}
        <section>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-lg border border-slate-200 bg-white p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {k.label}
                </dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums">{k.value.toLocaleString("fr-CA")}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Évolution dans le temps */}
        <section>
          <h2 className="mb-3 text-lg font-semibold">Évolution des offres</h2>
          {history.length >= 2 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <MarketTrendChart points={history} />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
              L'historique s'accumule à chaque scrape : la courbe apparaîtra dès que plusieurs
              relevés seront disponibles.
            </p>
          )}
        </section>

        {/* Répartition région / métier */}
        <section className="grid gap-8 sm:grid-cols-2">
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Offres par région</h2>
              <Link href="/emplois/region/" className="text-sm font-medium text-brand-700 hover:underline">
                Tout voir
              </Link>
            </div>
            <BarList rows={regions} href={(id) => `/emplois/region/${id}/`} max={regionMax} />
          </div>
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Offres par métier (CCQ)</h2>
              <Link href="/emplois/metier/" className="text-sm font-medium text-brand-700 hover:underline">
                Tout voir
              </Link>
            </div>
            <BarList rows={trades} href={(id) => `/emplois/metier/${id}/`} max={tradeMax} />
          </div>
        </section>

        {/* Baromètre de tension (#84) */}
        <section>
          <h2 className="mb-1 text-lg font-semibold">Baromètre de tension par métier</h2>
          <p className="mb-3 text-sm text-slate-600">
            Demande (offres ouvertes) par métier.{" "}
            {hasTension
              ? "La tension est le nombre d'offres pour 1000 travailleurs actifs."
              : "Le ratio offres / 1000 travailleurs s'affichera une fois les effectifs CCQ renseignés."}
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-semibold">Métier</th>
                  <th className="px-4 py-2 text-right font-semibold">Offres</th>
                  <th className="px-4 py-2 text-right font-semibold">Tension /1000</th>
                </tr>
              </thead>
              <tbody>
                {tension.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/emplois/metier/${t.id}/`} className="hover:text-brand-700">
                        {t.label}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{t.count}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                      {t.tension != null ? t.tension.toFixed(1) : "à renseigner"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Effectifs de main-d'œuvre : {CCQ_WORKFORCE_SOURCE.title}, {CCQ_WORKFORCE_SOURCE.published}.
          </p>
        </section>
      </div>
    </div>
  );
}
