"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { profileIsSet } from "@jobccq/shared";
import { ProfileForm } from "./ProfileForm";
import { useAuth } from "@/lib/auth";
import { clearProfile, useProfile } from "@/lib/profile";
import { supabaseEnabled } from "@/lib/supabase";
import { filtersToQueryString, profileToFilters } from "@/lib/search-url";

export function ProfilView() {
  const router = useRouter();
  const profile = useProfile();
  const { user } = useAuth();
  const set = profileIsSet(profile);

  return (
    <div>
      {supabaseEnabled && (
        <p className="mb-3 text-sm text-slate-600">
          {user
            ? "Synchronisé avec tes autres appareils via ton compte."
            : "Connecte-toi ci-dessus pour retrouver ce profil sur tous tes appareils."}
        </p>
      )}
      <div className="card p-5">
        <ProfileForm
          submitLabel="Enregistrer le profil"
          onSaved={(p) => {
            if (profileIsSet(p)) {
              const qs = filtersToQueryString(profileToFilters(p));
              router.push(qs ? `/emplois?${qs}` : "/emplois");
            }
          }}
        />
      </div>
      {set && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <Link href="/emplois" className="font-medium text-brand-700 hover:underline">
            Voir les offres sans filtres
          </Link>
          <button
            type="button"
            onClick={() => clearProfile()}
            className="text-slate-500 hover:text-red-600 hover:underline"
          >
            Effacer le profil
          </button>
        </p>
      )}
    </div>
  );
}
