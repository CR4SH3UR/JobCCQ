import type { ReactNode } from "react";
import { AccountSidebar } from "@/components/AccountSidebar";
import { AccountAuthPanel } from "@/components/AccountAuthPanel";

/**
 * Disposition de l'**espace utilisateur** (candidatures, favoris, alertes) :
 * un menu latéral commun à gauche + le contenu de la page à droite (empilé sur
 * mobile). Le groupe de routes `(compte)` ne change pas les URL (/favoris, etc.).
 */
export default function CompteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <AccountSidebar />
        <main className="min-w-0 flex-1">
          <AccountAuthPanel />
          {children}
        </main>
      </div>
    </div>
  );
}
