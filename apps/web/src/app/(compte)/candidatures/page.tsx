import type { Metadata } from "next";
import { CandidaturesView } from "@/components/CandidaturesView";

export const metadata: Metadata = {
  title: "Mes candidatures — JobCCQc",
  description: "Les offres où vous avez marqué avoir postulé.",
};

export default function CandidaturesPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">Mes candidatures</h1>
      <p className="mt-1 text-slate-600">
        Suivi des offres : statut, notes et rappel pour relancer.
      </p>
      <div className="mt-5">
        <CandidaturesView />
      </div>
    </section>
  );
}
