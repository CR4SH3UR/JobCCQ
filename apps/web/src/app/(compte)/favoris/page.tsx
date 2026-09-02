import type { Metadata } from "next";
import { FavorisView } from "@/components/FavorisView";

export const metadata: Metadata = {
  title: "Mes favoris — JobCCQc",
  description: "Vos offres d'emploi sauvegardées.",
};

export default function FavorisPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">Mes favoris</h1>
      <p className="mt-1 text-slate-600">Les offres que vous avez sauvegardées.</p>
      <div className="mt-5">
        <FavorisView />
      </div>
    </section>
  );
}
