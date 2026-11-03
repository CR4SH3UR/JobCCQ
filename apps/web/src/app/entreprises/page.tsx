import type { Metadata } from "next";
import Link from "next/link";
import { CompaniesExplorer } from "@/components/CompaniesExplorer";

export const metadata: Metadata = {
  title: "Qui recrute — JobCCQc",
  description: "Découvrez les entreprises qui recrutent au Québec et au Canada.",
};

export default function EntreprisesPage() {
  return (
    <div className="min-w-0 overflow-x-hidden">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-3 py-3 sm:px-4 sm:py-6">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Qui recrute</h1>
          <p className="mt-0.5 text-sm text-slate-600 sm:mt-1 sm:text-base">
            Les entreprises qui embauchent, classées par nombre de postes ouverts.
          </p>
          <p className="mt-1.5 flex flex-wrap gap-x-1.5 gap-y-0.5 text-xs text-slate-500 sm:mt-2 sm:text-sm">
            <span>Classement</span>
            <Link href="/entreprises/pres-de-moi/" className="font-medium text-brand-700 hover:underline">
              près de chez moi
            </Link>
            <span aria-hidden>·</span>
            <Link href="/entreprises/region/" className="font-medium text-brand-700 hover:underline">
              par région
            </Link>
            <span aria-hidden>·</span>
            <Link href="/entreprises/metier/" className="font-medium text-brand-700 hover:underline">
              par métier
            </Link>
          </p>
        </div>
      </div>
      <CompaniesExplorer />
    </div>
  );
}
