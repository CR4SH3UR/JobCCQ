"use client";

import { useEffect, useState } from "react";
import { ContactEmailButton } from "@/components/ContactEmailButton";

/**
 * Mince bandeau « beta » : rappelle la fréquence de mise à jour des offres et
 * offre un lien de retour (courriel). Rejetable (mémorisé dans le navigateur).
 */
const KEY = "beta-banner-dismissed-v1";

export function BetaBanner() {
  // On masque par défaut (évite un flash avant lecture du localStorage au montage).
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* stockage indisponible : on masque quand même pour la session */
    }
    setHidden(true);
  };

  return (
    <div className="border-b border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-sm">
        <span className="flex-1">
          🚧 <strong>Version beta</strong> — les offres sont mises à jour 2×/semaine. Une idée ou un
          problème ?{" "}
          <ContactEmailButton
            label="Écris-nous"
            subject="Retour beta — JobCCQc"
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          />
          .
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer le bandeau"
          className="shrink-0 rounded p-1 leading-none text-amber-700 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/50"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
