import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CCQ_SALARY_URL, CCQ_WAGE_AS_OF, formatCcqHourly } from "@jobccq/shared";
import { salaryGuide, salaryGuideTrade } from "@/lib/static-data";
import { siteUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams(): { metier: string }[] {
  return salaryGuide().map((r) => ({ metier: r.tradeId }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ metier: string }>;
}): Promise<Metadata> {
  const { metier } = await params;
  const row = salaryGuideTrade(metier);
  if (!row) return { title: "Salaire — JobCCQc" };
  const observed = row.observedMedian != null ? formatCcqHourly(row.observedMedian) : "à préciser";
  const title = `Salaire ${row.tradeLabel} au Québec | JobCCQc`;
  const description = `Salaire ${row.tradeLabel.toLowerCase()} : médiane observée ${observed}${
    row.ccqHourly != null ? `, grille CCQ ${formatCcqHourly(row.ccqHourly)}` : ""
  }. Offres par région.`;
  const url = siteUrl(`/salaire/${metier}/`);
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, type: "website" } };
}

export default async function SalaireMetierPage({ params }: { params: Promise<{ metier: string }> }) {
  const { metier } = await params;
  const row = salaryGuideTrade(metier);
  if (!row) notFound();

  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <p className="text-sm text-slate-500">
            <Link href="/salaire/" className="hover:text-brand-700">
              Guide salarial
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Salaire — {row.tradeLabel}</h1>
          <p className="mt-1 text-slate-600">
            {row.observedMedian != null
              ? `Médiane observée ${formatCcqHourly(row.observedMedian)} (${row.sample} offres avec salaire).`
              : `${row.sample} offre${row.sample > 1 ? "s" : ""} avec salaire — médiane dès 3 relevés.`}
            {row.ccqHourly != null
              ? ` Grille CCQ compagnon : ${formatCcqHourly(row.ccqHourly)} (en vigueur le ${new Date(CCQ_WAGE_AS_OF).toLocaleDateString("fr-CA")}).`
              : ""}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {row.regions.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-semibold">Région</th>
                  <th className="px-4 py-2 text-right font-semibold">Médiane</th>
                  <th className="px-4 py-2 text-right font-semibold">Salaires</th>
                </tr>
              </thead>
              <tbody>
                {row.regions.map((r) => (
                  <tr key={r.regionId} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/emplois/region/${r.regionId}/`} className="hover:text-brand-700">
                        {r.label}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.median != null ? formatCcqHourly(r.median) : "n < 3"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">{r.sample}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-sm">
          <Link href={`/emplois/metier/${row.tradeId}/`} className="font-medium text-brand-700 hover:underline">
            Voir les offres de {row.tradeLabel}
          </Link>
          {" · "}
          <a href={CCQ_SALARY_URL} className="text-slate-500 hover:underline" target="_blank" rel="noreferrer">
            Grille CCQ
          </a>
        </p>
      </div>
    </div>
  );
}
