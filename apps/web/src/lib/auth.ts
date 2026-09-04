"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseEnabled } from "./supabase";

/**
 * Authentification : **courriel + mot de passe** ou **lien magique** (sans mot
 * de passe). `useAuth` expose l'utilisateur courant ; `signInWithPassword` /
 * `signUpWithPassword` gèrent le mot de passe ; `signInWithEmail` envoie un lien
 * magique ; `updatePassword` (dé)définit le mot de passe une fois connecté ;
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

/** Traduit les erreurs d'authentification Supabase en messages clairs (FR). */
function friendlyAuthError(raw: string): string {
  const m = raw.toLowerCase();
  if (/rate limit|too many|only request this after|\bafter \d+ seconds\b/.test(m)) {
    return "Trop de demandes de connexion pour l'instant. Patiente quelques minutes, puis réessaie.";
  }
  if (/invalid login credentials|invalid credentials/.test(m)) {
    return "Courriel ou mot de passe incorrect.";
  }
  if (/already registered|already been registered|user already exists/.test(m)) {
    return "Un compte existe déjà avec ce courriel. Connecte-toi plutôt.";
  }
  if (/password.*(6|at least|too short|should be)|weak password/.test(m)) {
    return "Le mot de passe doit contenir au moins 6 caractères.";
  }
  if (/email not confirmed|not confirmed/.test(m)) {
    return "Confirme d'abord ton courriel : ouvre le lien qu'on t'a envoyé.";
  }
  if (/invalid|valid email|unable to validate/.test(m)) {
    return "Adresse courriel invalide. Vérifie et réessaie.";
  }
  if (/signups? not allowed|disabled/.test(m)) {
    return "Les inscriptions sont désactivées pour le moment.";
  }
  return "Connexion impossible pour le moment. Réessaie dans quelques minutes.";
}

/** Envoie un lien magique à l'adresse fournie. */
export async function signInWithEmail(email: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Comptes non configurés." };
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirectUrl() },
  });
  if (!error) return {};
  // Message brut conservé en console pour le débogage ; message clair à l'écran.
  console.warn("Supabase auth:", error.message);
  return { error: friendlyAuthError(error.message) };
}

/** Connexion par courriel + mot de passe. */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ error?: string }> {
  if (!supabase) return { error: "Comptes non configurés." };
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (!error) return {};
  console.warn("Supabase auth:", error.message);
  return { error: friendlyAuthError(error.message) };
}

/**
 * Création d'un compte par courriel + mot de passe. Retourne
 * `needsConfirmation: true` si Supabase exige une confirmation par courriel
 * (aucune session ouverte tant que le lien n'est pas cliqué).
 */
export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<{ error?: string; needsConfirmation?: boolean }> {
  if (!supabase) return { error: "Comptes non configurés." };
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: redirectUrl() },
  });
  if (error) {
    console.warn("Supabase auth:", error.message);
    return { error: friendlyAuthError(error.message) };
  }
  return { needsConfirmation: !data.session };
}

/** Définit ou change le mot de passe de l'utilisateur connecté. */
export async function updatePassword(password: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Comptes non configurés." };
  const { error } = await supabase.auth.updateUser({ password });
  if (!error) return {};
  console.warn("Supabase auth:", error.message);
  return { error: friendlyAuthError(error.message) };
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/**
 * Liste blanche des administrateurs, définie **au build** via la variable
 * `NEXT_PUBLIC_ADMIN_EMAILS` (courriels séparés par des virgules). On garde les
 * courriels hors du code source : ils sont fournis par une variable GitHub, comme
 * les clés Supabase.
 */
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** Une liste blanche a-t-elle été configurée ? (sinon l'admin est verrouillé) */
export const adminAllowlistConfigured = ADMIN_EMAILS.length > 0;

/** Ce courriel figure-t-il dans la liste blanche des administrateurs ? */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
