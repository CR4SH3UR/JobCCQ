"use client";

import { useState } from "react";
import { useAuth, updatePassword, signOut } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

/**
 * Connexion **intégrée à l'espace utilisateur** (colonne de droite). Déconnecté
 * → formulaire courriel + mot de passe (ou lien magique), via `LoginForm`.
 * Connecté → adresse, déconnexion et définition/changement du mot de passe.
 * Rendu seulement si Supabase est configuré ; sinon rien (données locales).
 */
export function AccountAuthPanel() {
  const { user, loading, enabled } = useAuth();

  if (!enabled || loading) return null;
  if (user) return <ConnectedBar email={user.email ?? ""} />;

  return (
    <div className="card mb-5 border-brand-200 bg-brand-50 p-4">
      <LoginForm />
    </div>
  );
}

type Status = { kind: "idle" | "busy" | "error"; msg?: string };

const inputCls =
  "min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

/** Barre « connecté » + possibilité de définir/changer son mot de passe. */
function ConnectedBar({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setStatus({ kind: "error", msg: "Le mot de passe doit contenir au moins 6 caractères." });
      return;
    }
    setStatus({ kind: "busy" });
    const { error } = await updatePassword(password);
    if (error) setStatus({ kind: "error", msg: error });
    else {
      setStatus({ kind: "idle" });
      setPassword("");
      setOpen(false);
    }
  };

  return (
    <div className="card mb-5 border-green-200 bg-green-50 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-green-800">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          Connecté · <strong className="font-semibold">{email}</strong> · synchronisé sur tous tes appareils
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-green-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            {open ? "Annuler" : "Mot de passe"}
          </button>
          <button
            onClick={() => void signOut()}
            className="rounded-lg border border-green-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            Se déconnecter
          </button>
        </div>
      </div>

      {open && (
        <form onSubmit={save} className="mt-3 flex flex-col gap-2 border-t border-green-200 pt-3 sm:flex-row">
          <input
            type={showPw ? "text" : "password"}
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nouveau mot de passe (min. 6)"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {showPw ? "Cacher" : "Afficher"}
          </button>
          <button
            type="submit"
            disabled={status.kind === "busy"}
            className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {status.kind === "busy" ? "…" : "Enregistrer"}
          </button>
        </form>
      )}
      {status.kind === "error" && <p className="mt-2 text-sm text-red-600">{status.msg}</p>}
    </div>
  );
}
