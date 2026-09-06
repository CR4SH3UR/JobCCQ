import type { Metadata } from "next";
import { ProfilView } from "@/components/ProfilView";

export const metadata: Metadata = {
  title: "Mon profil — JobCCQc",
  description: "Métiers, régions et mobilité pour personnaliser l'accueil et le score d'adéquation.",
};

export default function ProfilPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">Mon profil</h1>
      <p className="mt-1 text-slate-600">
        Tes métiers, régions et modes de travail. L'accueil propose des offres pour toi, et
        chaque fiche affiche un score d'adéquation. Avec un compte, ce profil te suit sur
        tous tes appareils.
      </p>
      <div className="mt-5">
        <ProfilView />
      </div>
    </section>
  );
}
