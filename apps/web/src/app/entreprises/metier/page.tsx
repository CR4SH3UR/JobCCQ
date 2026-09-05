import type { Metadata } from "next";
import Link from "next/link";
import { tradesWithCounts } from "@/lib/static-data";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Qui recrute par métier — JobCCQc",
  description:
    "Classement des employeurs qui recrutent le plus, par métier de la construction reconnu par la CCQ.",
  alternates: { canonical: siteUrl("/entreprises/metier/") },
};

export default function EntreprisesMetierIndexPage() {
  const trades = tradesWithCounts();
  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Qui recrute par métier</h1>
          <p className="mt-1 text-slate-600">
            Les employeurs classés par nombre de postes ouverts, pour chaque métier CCQ.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-4 py-6">
        {trades.length === 0 ? (
          <p className="text-slate-600">Aucun métier avec des offres pour le moment.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {trades.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/entreprises/metier/${t.id}/`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-brand-300 hover:text-brand-700"
                >
                  <span className="font-medium">{t.label}</span>
                  <span className="text-sm text-slate-400">{t.count} offres</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-sm text-slate-500">
          Ou le classement{" "}
          <Link href="/entreprises/region/" className="font-medium text-brand-700 hover:underline">
            par région
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
