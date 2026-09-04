"use client";

import { useState } from "react";
import Link from "next/link";
import { signInWithEmail, signInWithPassword, signUpWithPassword } from "@/lib/auth";

/**
 * Formulaire de connexion **partagé** (en-tête et espace utilisateur). Trois
 * modes : courriel + mot de passe (connexion), création de compte, ou lien
 * magique (sans mot de passe). Gère ses propres états (envoi, confirmation,
 * erreurs). L'état « connecté » et l'habillage (carte, popover) sont laissés au
 * composant parent.
 */
type Mode = "signin" | "signup" | "magic";
type Status = { kind: "idle" | "busy" | "magicSent" | "confirmSent" | "error"; msg?: string };

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export function LoginForm({ onNavigate }: { onNavigate?: () => void }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const switchMode = (m: Mode) => {
    setMode(m);
    setStatus({ kind: "idle" });
    setPassword("");
    setPassword2("");
  };

  if (status.kind === "magicSent" || status.kind === "confirmSent") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
        {status.kind === "magicSent" ? (
          <>
            ✅ Lien envoyé à <strong>{email}</strong>. Ouvre ton courriel et clique sur le lien pour te
            connecter.
          </>
        ) : (
          <>
            ✅ Compte créé pour <strong>{email}</strong>. Ouvre ton courriel et clique sur le lien de
            confirmation, puis reviens te connecter.
          </>
        )}
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mail = email.trim();
    if (!mail) return;

    if (mode === "magic") {
      setStatus({ kind: "busy" });
      const { error } = await signInWithEmail(mail);
      setStatus(error ? { kind: "error", msg: error } : { kind: "magicSent" });
      return;
    }

    if (password.length < 6) {
      setStatus({ kind: "error", msg: "Le mot de passe doit contenir au moins 6 caractères." });
      return;
    }
    if (mode === "signup" && password !== password2) {
      setStatus({ kind: "error", msg: "Les mots de passe ne correspondent pas." });
      return;
    }

    setStatus({ kind: "busy" });
    if (mode === "signin") {
      const { error } = await signInWithPassword(mail, password);
      // Succès → onAuthStateChange fait basculer le parent vers « connecté ».
      setStatus(error ? { kind: "error", msg: error } : { kind: "idle" });
    } else {
      const { error, needsConfirmation } = await signUpWithPassword(mail, password);
      if (error) setStatus({ kind: "error", msg: error });
      else if (needsConfirmation) setStatus({ kind: "confirmSent" });
      else setStatus({ kind: "idle" });
    }
  };

  const busy = status.kind === "busy";

  return (
    <div>
      <p className="text-sm text-slate-600">
        {mode === "signup"
          ? "Crée ton compte pour synchroniser tes favoris, candidatures et alertes sur tous tes appareils."
          : mode === "magic"
            ? "On t'envoie un lien de connexion — aucun mot de passe à retenir."
            : "Connecte-toi pour retrouver tes favoris, candidatures et alertes sur tous tes appareils."}
      </p>

      <form onSubmit={submit} className="mt-3 space-y-2">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ton@courriel.com"
          className={inputCls}
        />

        {mode !== "magic" && (
          <>
            <div className="flex gap-2">
              <input
                type={showPw ? "text" : "password"}
                required
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-pressed={showPw}
                className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {showPw ? "Cacher" : "Afficher"}
              </button>
            </div>
            {mode === "signup" && (
              <input
                type={showPw ? "text" : "password"}
                required
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Confirme le mot de passe"
                className={inputCls}
              />
            )}
          </>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy
            ? "…"
            : mode === "signup"
              ? "Créer mon compte"
              : mode === "magic"
                ? "Recevoir le lien"
                : "Se connecter"}
        </button>
      </form>

      {status.kind === "error" && <p className="mt-2 text-sm text-red-600">{status.msg}</p>}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {mode !== "signin" && (
          <button onClick={() => switchMode("signin")} className="font-medium text-brand-700 hover:underline">
            J'ai déjà un mot de passe
          </button>
        )}
        {mode !== "signup" && (
          <button onClick={() => switchMode("signup")} className="font-medium text-brand-700 hover:underline">
            Créer un compte
          </button>
        )}
        {mode !== "magic" && (
          <button onClick={() => switchMode("magic")} className="font-medium text-brand-700 hover:underline">
            Recevoir un lien magique
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        En continuant, tu acceptes notre{" "}
        <Link href="/confidentialite" onClick={onNavigate} className="underline hover:text-brand-600">
          politique de confidentialité
        </Link>{" "}
        et nos{" "}
        <Link href="/conditions" onClick={onNavigate} className="underline hover:text-brand-600">
          conditions
        </Link>
        .
      </p>
    </div>
  );
}
