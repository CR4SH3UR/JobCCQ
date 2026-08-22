"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseEnabled } from "./supabase";

/**
 * Authentification par **lien magique** (courriel, sans mot de passe).
 * `useAuth` expose l'utilisateur courant ; `signInWithEmail` envoie le lien ;
 * `signOut` déconnecte. Tout est no-op si Supabase n'est pas configuré.
 */
export function useAuth(): { user: User | null; loading: boolean; enabled: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading, enabled: supabaseEnabled };
}

/** URL de retour après clic sur le lien magique (respecte le basePath GitHub Pages). */
function redirectUrl(): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${window.location.origin}${base}/favoris`;
}

/** Envoie un lien magique à l'adresse fournie. */
export async function signInWithEmail(email: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Comptes non configurés." };
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirectUrl() },
  });
  return error ? { error: error.message } : {};
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}
