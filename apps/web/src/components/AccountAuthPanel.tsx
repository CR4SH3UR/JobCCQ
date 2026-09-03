"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth, signInWithEmail, signOut } from "@/lib/auth";

/**
 * Connexion **intégrée à l'espace utilisateur** (colonne de droite) : au lieu de
 * renvoyer vers le bouton d'en-tête, on peut se connecter directement ici par
 * lien magique. Rendu seulement si Supabase est configuré ; sinon rien (les
 * données restent locales au navigateur).
 */
export function AccountAuthPanel() {
  const { user, loading, enabled } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "sending" | "sent" | "error"; msg?: string }>({
    kind: "idle",
  });

  if (!enabled || loading) return null;

  if (user) {
    return (
      <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 border-green-200 bg-green-50 p-3 text-sm">
        <span className="flex items-center gap-2 text-green-800">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          Connecté · <strong className="font-semibold">{user.email}</strong> · synchronisé sur tous tes appareils
        </span>
        <button
          onClick={() => void signOut()}
          className="rounded-lg border border-green-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
        >
          Se déconnecter
        </button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus({ kind: "sending" });
    const { error } = await signInWithEmail(email);
    setStatus(error ? { kind: "error", msg: error } : { kind: "sent" });
  };

  if (status.kind === "sent") {
    return (
      <div className="card mb-5 border-green-200 bg-green-50 p-4 text-sm text-green-800">
        ✅ Lien envoyé à <strong>{email}</strong>. Ouvre ton courriel et clique sur le lien pour te connecter —
        tes favoris, candidatures et alertes seront synchronisés.
      </div>
    );
  }

  return (
    <div className="card mb-5 border-brand-200 bg-brand-50 p-4">
      <p className="text-sm font-semibold text-brand-900">Connecte-toi pour synchroniser ton espace</p>
      <p className="mt-1 text-sm text-brand-800/80">
        Retrouve tes favoris, candidatures et alertes sur tous tes appareils. On t'envoie un lien magique —
        aucun mot de passe.
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ton@courriel.com"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          disabled={status.kind === "sending"}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {status.kind === "sending" ? "Envoi…" : "Recevoir le lien"}
        </button>
      </form>
      {status.kind === "error" && <p className="mt-2 text-sm text-red-600">{status.msg}</p>}
      <p className="mt-2 text-xs text-slate-500">
        En continuant, tu acceptes notre{" "}
        <Link href="/confidentialite" className="underline hover:text-brand-700">
          politique de confidentialité
        </Link>{" "}
        et nos{" "}
        <Link href="/conditions" className="underline hover:text-brand-700">
          conditions
        </Link>
        .
      </p>
    </div>
  );
}
