import type { Metadata } from "next";
import { FavorisView } from "@/components/FavorisView";

export const metadata: Metadata = {
  title: "Mes favoris — JobCCQ",
  description: "Vos offres d'emploi sauvegardées.",
};

export default function FavorisPage() {
  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Mes favoris</h1>
          <p className="mt-1 text-slate-600">
            Les offres que vous avez sauvegardées, dans ce navigateur.
          </p>
        </div>
      </div>
      <FavorisView />
    </div>
  );
}
