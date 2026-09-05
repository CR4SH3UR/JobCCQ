import type { Metadata } from "next";
import Link from "next/link";
import { regionsWithCounts } from "@/lib/static-data";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Emplois par région — JobCCQc",
  description:
    "Parcourez les offres d'emploi en construction et génie civil par région administrative du Québec.",
  alternates: { canonical: siteUrl("/emplois/region/") },
};

export default function RegionIndexPage() {
  const regions = regionsWithCounts();
  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Emplois par région</h1>
          <p className="mt-1 text-slate-600">
            Les offres en construction et génie civil, par région administrative du Québec.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {regions.map((r) => (
            <li key={r.id}>
              <Link
                href={`/emplois/region/${r.id}/`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-brand-300 hover:text-brand-700"
              >
                <span className="font-medium">{r.label}</span>
                <span className="text-sm text-slate-400">{r.count}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-slate-500">
          Ou parcourez{" "}
          <Link href="/emplois/metier/" className="font-medium text-brand-700 hover:underline">
            par métier
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
