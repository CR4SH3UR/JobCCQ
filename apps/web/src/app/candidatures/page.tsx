import type { Metadata } from "next";
import { CandidaturesView } from "@/components/CandidaturesView";

export const metadata: Metadata = {
  title: "Mes candidatures — JobCCQc",
  description: "Les offres où vous avez marqué avoir postulé.",
};

export default function CandidaturesPage() {
  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Mes candidatures</h1>
          <p className="mt-1 text-slate-600">
            Les offres où vous avez indiqué avoir envoyé votre CV.
          </p>
        </div>
      </div>
      <CandidaturesView />
    </div>
  );
}
