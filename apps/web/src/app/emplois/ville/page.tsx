import type { Metadata } from "next";
import Link from "next/link";
import { citiesWithCounts } from "@/lib/static-data";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Emplois par ville — JobCCQc",
  description:
    "Offres d'emploi en construction par ville au Québec : Laval, Gatineau, Lévis, Sherbrooke, Montréal, Québec…",
  alternates: { canonical: siteUrl("/emplois/ville/") },
};

export default function VilleIndexPage() {
  const cities = citiesWithCounts();
  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Emplois par ville</h1>
          <p className="mt-1 text-slate-600">
            Les postes ouverts en construction et génie civil, dans les principales villes du Québec.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-4 py-6">
        {cities.length === 0 ? (
          <p className="text-slate-600">Aucune offre géolocalisée pour le moment.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {cities.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/emplois/ville/${c.id}/`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-brand-300 hover:text-brand-700"
                >
                  <span className="font-medium">{c.label}</span>
                  <span className="text-sm text-slate-400">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-sm text-slate-500">
          Aussi parcourir{" "}
          <Link href="/emplois/region/" className="font-medium text-brand-700 hover:underline">
            par région
          </Link>{" "}
          ou{" "}
          <Link href="/emplois/metier/" className="font-medium text-brand-700 hover:underline">
            par métier
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
