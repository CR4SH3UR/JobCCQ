"use client";

import { useState } from "react";
import { useAuth, signInWithEmail, signOut } from "@/lib/auth";
import { cn } from "@/lib/format";

/**
 * Contrôle de connexion (lien magique). Rendu uniquement si Supabase est
 * configuré ; sinon rien (les favoris restent locaux). Déconnecté → formulaire
 * courriel ; connecté → adresse + déconnexion.
 */
export function AuthButton() {
  const { user, loading, enabled } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "sending" | "sent" | "error"; msg?: string }>({
    kind: "idle",
  });

  if (!enabled || loading) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus({ kind: "sending" });
    const { error } = await signInWithEmail(email);
    setStatus(error ? { kind: "error", msg: error } : { kind: "sent" });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
          user ? "text-slate-700 hover:bg-slate-100" : "bg-brand-600 text-white hover:bg-brand-700",
        )}
        title={user ? user.email ?? "Mon compte" : "Se connecter"}
      >
        {user ? (
          <>
            <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              {(user.email ?? "?")[0]!.toUpperCase()}
            </span>
            <span className="hidden max-w-[9rem] truncate sm:inline">{user.email}</span>
          </>
        ) : (
          <span>Se connecter</span>
        )}
      </button>

      {open && (
        <>
          {/* Fond cliquable pour fermer */}
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 cursor-default"
          />
          <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
            {user ? (
              <div className="flex flex-col gap-2">
                <p className="text-slate-600">
                  Connecté en tant que <span className="font-medium text-slate-900">{user.email}</span>. Tes
                  favoris sont synchronisés sur tous tes appareils.
                </p>
                <button
                  onClick={() => {
                    void signOut();
                    setOpen(false);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100"
                >
                  Se déconnecter
                </button>
              </div>
            ) : status.kind === "sent" ? (
              <div className="text-slate-700">
                ✅ Lien envoyé à <span className="font-medium">{email}</span>. Ouvre ton courriel et clique sur
                le lien pour te connecter.
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-2">
                <p className="text-slate-600">
                  Connecte-toi pour <strong>synchroniser tes favoris</strong> sur tous tes appareils. On
                  t'envoie un lien magique — aucun mot de passe.
                </p>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ton@courriel.com"
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
                <button
                  type="submit"
                  disabled={status.kind === "sending"}
                  className="rounded-lg bg-brand-600 px-3 py-2 font-semibold text-white disabled:opacity-50"
                >
                  {status.kind === "sending" ? "Envoi…" : "Envoyer le lien magique"}
                </button>
                {status.kind === "error" && <p className="text-red-600">{status.msg}</p>}
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
