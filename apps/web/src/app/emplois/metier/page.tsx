import type { Metadata } from "next";
import Link from "next/link";
import { tradesWithCounts } from "@/lib/static-data";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Emplois par métier — JobCCQc",
  description:
    "Parcourez les offres d'emploi par métier de la construction reconnu par la CCQ (charpentier-menuisier, électricien, grutier…).",
  alternates: { canonical: siteUrl("/emplois/metier/") },
};

export default function MetierIndexPage() {
  const trades = tradesWithCounts();
  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Emplois par métier</h1>
          <p className="mt-1 text-slate-600">
            Les offres par métier de la construction reconnu par la CCQ.
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
                  href={`/emplois/metier/${t.id}/`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-brand-300 hover:text-brand-700"
                >
                  <span className="font-medium">{t.label}</span>
                  <span className="text-sm text-slate-400">{t.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-sm text-slate-500">
          Ou parcourez{" "}
          <Link href="/emplois/region/" className="font-medium text-brand-700 hover:underline">
            par région
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
