import type { Metadata } from "next";
import Link from "next/link";
import { JobsMapView } from "@/components/JobsMapView";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Carte des offres — JobCCQc",
  description: "Carte interactive des offres d'emploi construction au Québec, par ville et région.",
  alternates: { canonical: siteUrl("/emplois/carte/") },
};

export default function CarteEmploisPage() {
  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Carte des offres</h1>
          <p className="mt-1 text-slate-600">
            Chaque point regroupe les postes d'une ville (ou du centroïde de la région). Cliquez pour
            voir les titres. Pour filtrer « à moins de X km », utilisez{" "}
            <Link href="/emplois/" className="font-medium text-brand-700 hover:underline">
              la recherche
            </Link>
            .
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <JobsMapView />
      </div>
    </div>
  );
}
