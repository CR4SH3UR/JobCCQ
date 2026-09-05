import type { Metadata } from "next";
import Link from "next/link";
import { NearMeView } from "@/components/NearMeView";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Qui recrute près de chez moi — JobCCQc",
  description:
    "Entrez un code postal ou une ville du Québec pour voir les employeurs de la construction qui embauchent dans votre région.",
  alternates: { canonical: siteUrl("/entreprises/pres-de-moi/") },
};

export default function PresDeMoiPage() {
  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Qui recrute près de chez moi</h1>
          <p className="mt-1 text-slate-600">
            Un code postal ou une ville suffit : on te place dans la région administrative, puis on
            liste les employeurs qui ont des postes ouverts.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Même index que le reste du site (municipalités + FSA). Ou explore{" "}
            <Link href="/entreprises/region/" className="font-medium text-brand-700 hover:underline">
              par région
            </Link>
            {" · "}
            <Link href="/entreprises/" className="font-medium text-brand-700 hover:underline">
              tout le Québec
            </Link>
            .
          </p>
        </div>
      </div>
      <NearMeView />
    </div>
  );
}
