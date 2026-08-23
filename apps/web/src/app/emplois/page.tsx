import type { Metadata } from "next";
import { EmploisExplorer } from "@/components/EmploisExplorer";

export const metadata: Metadata = {
  title: "Emplois — JobCCQc",
  description: "Recherchez et filtrez les offres d'emploi du Québec et du Canada.",
};

export default function EmploisPage() {
  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Offres d'emploi</h1>
          <p className="mt-1 text-slate-600">
            Recherchez, filtrez et triez parmi toutes les offres agrégées.
          </p>
        </div>
      </div>
      <EmploisExplorer />
    </div>
  );
}
