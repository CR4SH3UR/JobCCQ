import type { Metadata } from "next";
import { AlertesView } from "@/components/AlertesView";

export const metadata: Metadata = {
  title: "Mes alertes — JobCCQc",
  description: "Recevez un courriel quand de nouvelles offres correspondent à vos recherches.",
};

export default function AlertesPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">Mes alertes</h1>
      <p className="mt-1 text-slate-600">
        Un courriel quand de nouvelles offres correspondent à vos recherches sauvegardées.
      </p>
      <div className="mt-5">
        <AlertesView />
      </div>
    </section>
  );
}
