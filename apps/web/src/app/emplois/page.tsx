import type { Metadata } from "next";
import Link from "next/link";
import { EmploisExplorer } from "@/components/EmploisExplorer";

export const metadata: Metadata = {
  title: "Emplois — JobCCQc",
  description: "Recherchez et filtrez les offres d'emploi du Québec et du Canada.",
};

export default function EmploisPage() {
  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-3 py-3 sm:px-4 sm:py-6">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Offres d'emploi</h1>
          <p className="mt-0.5 text-sm text-slate-600 sm:mt-1 sm:text-base">
            Recherchez, filtrez et triez parmi toutes les offres agrégées.
          </p>
          <p className="mt-1.5 text-xs text-slate-500 sm:mt-2 sm:text-sm">
            Parcourir{" "}
            <Link href="/emplois/region/" className="font-medium text-brand-700 hover:underline">
              par région
            </Link>
            {" · "}
            <Link href="/emplois/metier/" className="font-medium text-brand-700 hover:underline">
              par métier
            </Link>
            {" · "}
            <Link href="/emplois/comparer/" className="font-medium text-brand-700 hover:underline">
              comparateur
            </Link>
            {" · "}
            <Link href="/emplois/carte/" className="font-medium text-brand-700 hover:underline">
              carte
            </Link>
            {" · "}
            <a href="/emplois.rss" className="font-medium text-brand-700 hover:underline">
              flux RSS
            </a>
            .
          </p>
        </div>
      </div>
      <EmploisExplorer />
    </div>
  );
}
