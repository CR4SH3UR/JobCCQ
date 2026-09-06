"use client";

import { useState } from "react";
import Link from "next/link";
import {
  signInWithEmail,
  signInWithPassword,
  signUpWithPassword,
  resetPassword,
  signInWithGitHub,
} from "@/lib/auth";

/**
 * Formulaire de connexion **partagé** (en-tête et espace utilisateur). Trois
 * modes : courriel + mot de passe (connexion), création de compte, ou lien
 * magique (sans mot de passe). Gère ses propres états (envoi, confirmation,
 * erreurs). L'état « connecté » et l'habillage (carte, popover) sont laissés au
 * composant parent.
 */
type Mode = "signin" | "signup" | "magic" | "forgot";
type Status = {
  kind: "idle" | "busy" | "magicSent" | "confirmSent" | "resetSent" | "error";
  msg?: string;
};

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

  if (status.kind === "magicSent" || status.kind === "confirmSent" || status.kind === "resetSent") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
        {status.kind === "magicSent" ? (
          <>
            ✅ Lien envoyé à <strong>{email}</strong>. Ouvre ton courriel et clique sur le lien pour te
            connecter.
          </>
        ) : status.kind === "confirmSent" ? (
          <>
            ✅ Compte créé pour <strong>{email}</strong>. Ouvre ton courriel et clique sur le lien de
            confirmation, puis reviens te connecter.
          </>
        ) : (
          <>
            ✅ Si un compte existe pour <strong>{email}</strong>, un lien de réinitialisation vient
            d'être envoyé. Ouvre ton courriel pour choisir un nouveau mot de passe.
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

    if (mode === "forgot") {
      setStatus({ kind: "busy" });
      const { error } = await resetPassword(mail);
      setStatus(error ? { kind: "error", msg: error } : { kind: "resetSent" });
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

  const onGitHub = async () => {
    setStatus({ kind: "busy" });
    const { error } = await signInWithGitHub();
    // Succès → la page est redirigée vers GitHub (rien à faire ici).
    if (error) setStatus({ kind: "error", msg: error });
  };

  const busy = status.kind === "busy";

  return (
    <div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {mode === "signup"
          ? "Crée ton compte pour synchroniser tes favoris, candidatures, profil et alertes sur tous tes appareils."
          : mode === "magic"
            ? "On t'envoie un lien de connexion — aucun mot de passe à retenir."
            : mode === "forgot"
              ? "Entre ton courriel : on t'envoie un lien pour choisir un nouveau mot de passe."
              : "Connecte-toi pour retrouver tes favoris, candidatures, profil et alertes sur tous tes appareils."}
      </p>

      {(mode === "signin" || mode === "signup") && (
        <>
          <button
            type="button"
            onClick={onGitHub}
            disabled={busy}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 fill-current">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Continuer avec GitHub
          </button>
          <div className="my-3 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            ou
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>
        </>
      )}

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

        {(mode === "signin" || mode === "signup") && (
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
                : mode === "forgot"
                  ? "Envoyer le lien de réinitialisation"
                  : "Se connecter"}
        </button>
      </form>

      {status.kind === "error" && <p className="mt-2 text-sm text-red-600">{status.msg}</p>}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {mode === "signin" && (
          <button onClick={() => switchMode("forgot")} className="font-medium text-brand-700 hover:underline">
            Mot de passe oublié ?
          </button>
        )}
        {mode !== "signin" && (
          <button onClick={() => switchMode("signin")} className="font-medium text-brand-700 hover:underline">
            {mode === "forgot" ? "Retour à la connexion" : "J'ai déjà un mot de passe"}
          </button>
        )}
        {mode !== "signup" && mode !== "forgot" && (
          <button onClick={() => switchMode("signup")} className="font-medium text-brand-700 hover:underline">
            Créer un compte
          </button>
        )}
        {mode !== "magic" && mode !== "forgot" && (
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
