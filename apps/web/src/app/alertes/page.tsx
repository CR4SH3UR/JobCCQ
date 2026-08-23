import type { Metadata } from "next";
import { AlertesView } from "@/components/AlertesView";

export const metadata: Metadata = {
  title: "Mes alertes — JobCCQc",
  description: "Recevez un courriel quand de nouvelles offres correspondent à vos recherches.",
};

export default function AlertesPage() {
  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Mes alertes</h1>
          <p className="mt-1 text-slate-600">
            Un courriel quand de nouvelles offres correspondent à tes recherches sauvegardées.
          </p>
        </div>
      </div>
      <AlertesView />
    </div>
  );
}
