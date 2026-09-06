import type { Metadata } from "next";
import { EmployerSpaceView } from "@/components/EmployerSpaceView";

export const metadata: Metadata = {
  title: "Espace employeur — JobCCQc",
  description: "Réclame ta fiche, publie une offre et suis les vues et clics Postuler.",
};

export default function EmployeurPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">Espace employeur</h1>
      <p className="mt-1 text-slate-600">
        Réclame la fiche de ton entreprise, corrige logo et description, publie une offre
        (modérée) et suis les vues et les clics « Postuler ».
      </p>
      <div className="mt-5">
        <EmployerSpaceView />
      </div>
    </section>
  );
}
