import type { Metadata } from "next";
import { CompaniesExplorer } from "@/components/CompaniesExplorer";

export const metadata: Metadata = {
  title: "Qui recrute — JobCCQc",
  description: "Découvrez les entreprises qui recrutent au Québec et au Canada.",
};

export default function EntreprisesPage() {
  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Qui recrute</h1>
          <p className="mt-1 text-slate-600">
            Les entreprises qui embauchent, classées par nombre de postes ouverts.
          </p>
        </div>
      </div>
      <CompaniesExplorer />
    </div>
  );
}
