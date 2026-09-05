"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { profileIsSet } from "@jobccq/shared";
import { ProfileForm } from "./ProfileForm";
import { dismissOnboarding, useOnboardingDismissed, useProfileIsSet } from "@/lib/profile";
import { filtersToQueryString, profileToFilters } from "@/lib/search-url";

/**
 * Bannière d'accueil : métier, région, mobilité → profil + filtres pré-remplis.
 * Masquée une fois le profil rempli ou si le visiteur a choisi « plus tard ».
 * Affichée seulement après montage (le profil vit dans localStorage).
 */
export function OnboardingCard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const dismissed = useOnboardingDismissed();
  const hasProfile = useProfileIsSet();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || dismissed || hasProfile) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pt-8">
      <div className="card border-brand-100 bg-gradient-to-br from-brand-50/70 to-white p-5 dark:border-brand-500/30 dark:from-brand-500/10 dark:to-slate-900">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
              En 30 secondes : ton métier, ta région
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              On pré-remplit la recherche et on classe les offres selon ton profil. Rien n'est
              envoyé : ça reste dans ce navigateur.
            </p>
          </div>
          <button
            type="button"
            onClick={() => dismissOnboarding()}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            Plus tard
          </button>
        </div>
        <ProfileForm
          compact
          submitLabel="Voir mes offres"
          onSaved={(p) => {
            if (!profileIsSet(p)) return;
            const qs = filtersToQueryString(profileToFilters(p));
            router.push(qs ? `/emplois?${qs}` : "/emplois");
          }}
        />
      </div>
    </section>
  );
}
