"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth, signOut } from "@/lib/auth";
import { cn } from "@/lib/format";
import { LoginForm } from "./LoginForm";

/**
 * Contrôle de connexion de l'en-tête. Rendu uniquement si Supabase est
 * configuré ; sinon rien (les favoris restent locaux). Déconnecté → formulaire
 * courriel + mot de passe (ou lien magique) via `LoginForm` ; connecté →
 * adresse + déconnexion.
 */
export function AuthButton() {
  const { user, loading, enabled } = useAuth();
  const [open, setOpen] = useState(false);

  if (!enabled || loading) return null;

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
                  favoris et alertes sont synchronisés sur tous tes appareils.
                </p>
                <div className="flex flex-col">
                  <Link
                    href="/favoris"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-2 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
                  >
                    ♥ Mes favoris
                  </Link>
                  <Link
                    href="/alertes"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-2 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
                  >
                    🔔 Mes alertes
                  </Link>
                </div>
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
            ) : (
              <LoginForm onNavigate={() => setOpen(false)} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
