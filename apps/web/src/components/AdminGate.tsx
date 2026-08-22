"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useAuth,
  signInWithEmail,
  signOut,
  isAdminEmail,
  adminAllowlistConfigured,
} from "@/lib/auth";

/**
 * Barrière d'accès à la console d'administration.
 *
 * - Supabase non configuré → aucune authentification possible : on laisse passer
 *   (comportement historique ; l'accès reste protégé par les jetons GitHub/Turso
 *   qu'il faut saisir pour agir).
 * - Supabase configuré → l'accès exige une **connexion** et un courriel présent
 *   dans la liste blanche `NEXT_PUBLIC_ADMIN_EMAILS`. Toute autre personne voit
 *   un écran de connexion / d'accès refusé.
 *
 * NB : c'est un garde-fou d'interface (site statique, sans serveur). La vraie
 * protection des actions vient des jetons requis pour scraper / écrire.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, loading, enabled } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState<string>();

  // Sans Supabase, impossible de restreindre par compte : on n'ajoute pas de
  // fausse barrière (l'accès effectif reste protégé par les jetons).
  if (!enabled) return <>{children}</>;

  if (loading) {
    return <Centered>Chargement…</Centered>;
  }

  // Liste blanche non définie → verrouillé, avec la marche à suivre (on ne
  // laisse pas la console ouverte à tout compte connecté).
  if (!adminAllowlistConfigured) {
    return (
      <Centered>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Accès administrateur verrouillé</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Définis la variable <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">NEXT_PUBLIC_ADMIN_EMAILS</code>{" "}
          (dépôt GitHub → Settings → Secrets and variables → Actions → Variables) avec ton courriel de compte, puis
          relance un déploiement.
        </p>
      </Centered>
    );
  }

  if (user && isAdminEmail(user.email)) {
    return <>{children}</>;
  }

  // Connecté mais non autorisé.
  if (user) {
    return (
      <Centered>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Accès refusé</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Le compte <span className="font-medium">{user.email}</span> n'a pas accès à l'administration.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => void signOut()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            Se déconnecter
          </button>
          <Link href="/" className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">
            Retour au site
          </Link>
        </div>
      </Centered>
    );
  }

  // Non connecté → formulaire de lien magique.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    const { error } = await signInWithEmail(email);
    if (error) {
      setStatus("error");
      setMsg(error);
    } else {
      setStatus("sent");
    }
  };

  return (
    <Centered>
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Administration</h1>
      {status === "sent" ? (
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          ✅ Lien envoyé à <span className="font-medium">{email}</span>. Ouvre ton courriel et clique sur le lien
          pour te connecter.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-2 text-left">
          <p className="text-slate-600 dark:text-slate-300">Connecte-toi avec ton compte administrateur.</p>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ton@courriel.com"
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-900"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="rounded-lg bg-brand-600 px-3 py-2 font-semibold text-white disabled:opacity-50"
          >
            {status === "sending" ? "Envoi…" : "Envoyer le lien magique"}
          </button>
          {status === "error" && <p className="text-red-600">{msg}</p>}
        </form>
      )}
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 text-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {children}
      </div>
    </div>
  );
}
