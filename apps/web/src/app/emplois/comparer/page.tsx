import type { Metadata } from "next";
import { CompareView } from "@/components/CompareView";

export const metadata: Metadata = {
  title: "Comparer des offres — JobCCQc",
  description: "Comparez 2 ou 3 offres d'emploi côte à côte : salaire, région, type de poste.",
  robots: { index: false, follow: true },
};

export default function ComparerPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Comparateur d'offres</h1>
      <p className="mt-1 text-slate-600">Salaire, région, type de poste, exigences et avantages — jusqu'à 3 offres.</p>
      <div className="mt-6">
        <CompareView />
      </div>
    </div>
  );
}
