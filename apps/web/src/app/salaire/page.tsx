import type { Metadata } from "next";
import Link from "next/link";
import { CCQ_SALARY_URL, CCQ_WAGE_AS_OF, CCQ_WAGE_SECTOR, formatCcqHourly } from "@jobccq/shared";
import { salaryGuide } from "@/lib/static-data";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Guide salarial construction Québec — JobCCQc",
  description:
    "Médianes salariales observées sur les offres d'emploi en construction au Québec, comparées à la grille CCQ compagnon (secteur institutionnel et commercial).",
  alternates: { canonical: siteUrl("/salaire/") },
};

export default function SalairePage() {
  const rows = salaryGuide();
  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Guide salarial — construction au Québec</h1>
          <p className="mt-1 text-slate-600">
            Médiane horaire des offres agrégées (quand au moins 3 salaires sont connus) et taux
            compagnon CCQ, secteur {CCQ_WAGE_SECTOR}, en vigueur le{" "}
            {new Date(CCQ_WAGE_AS_OF).toLocaleDateString("fr-CA")}.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Indicatif seulement — pas un bulletin de paie.{" "}
            <a href={CCQ_SALARY_URL} className="underline hover:text-brand-700" target="_blank" rel="noreferrer">
              Grille officielle CCQ
            </a>
            .
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-semibold">Métier</th>
                <th className="px-4 py-2 text-right font-semibold">Grille CCQ</th>
                <th className="px-4 py-2 text-right font-semibold">Médiane observée</th>
                <th className="px-4 py-2 text-right font-semibold">Salaires</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tradeId} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/salaire/${r.tradeId}/`} className="font-medium hover:text-brand-700">
                      {r.tradeLabel}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                    {r.ccqHourly != null ? formatCcqHourly(r.ccqHourly) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.observedMedian != null ? formatCcqHourly(r.observedMedian) : "n < 3"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-500">{r.sample}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Voir aussi le{" "}
          <Link href="/marche/" className="font-medium text-brand-700 hover:underline">
            marché
          </Link>{" "}
          et le{" "}
          <Link href="/rapport/" className="font-medium text-brand-700 hover:underline">
            rapport des 7 derniers jours
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
