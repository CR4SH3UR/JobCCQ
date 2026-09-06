"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { JobDetailView } from "@/components/JobDetailView";

function DirectJob() {
  const id = useSearchParams().get("id") ?? "";
  if (!id) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-slate-500">Offre introuvable.</p>
      </div>
    );
  }
  return <JobDetailView id={id} />;
}

/** Fiche pour une offre publiée par un employeur (pas de page SSG). */
export default function EmployerPostedJobPage() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-5xl px-4 py-8 text-slate-500">Chargement…</p>}>
      <DirectJob />
    </Suspense>
  );
}
