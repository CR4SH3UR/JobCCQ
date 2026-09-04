"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, supabaseEnabled } from "@/lib/supabase";
import { updatePassword, resetPassword } from "@/lib/auth";

/**
 * Page de réinitialisation du mot de passe. Le lien reçu par courriel ramène ici
 * avec une **session de récupération** (Supabase, `detectSessionInUrl`) → on
 * propose de choisir un nouveau mot de passe. Sans session (lien expiré ou visite
 * directe), on propose de renvoyer un lien.
 */
const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
const okCls =
  "mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200";

export function ResetPasswordView() {
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  // Formulaire « nouveau mot de passe »
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);

  // Formulaire « renvoyer un lien »
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setHasSession(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!supabaseEnabled) {
    return <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Les comptes ne sont pas activés.</p>;
  }
  if (loading) {
    return <p className="mt-4 text-sm text-slate-500">Chargement…</p>;
  }
  if (done) {
    return (
      <div className={okCls}>
        ✅ Mot de passe mis à jour — tu es connecté.{" "}
        <Link href="/favoris" className="font-semibold underline">
          Aller à mon espace
        </Link>
      </div>
    );
  }

  if (hasSession) {
    const save = async (e: React.FormEvent) => {
      e.preventDefault();
      if (pw.length < 6) {
        setErr("Le mot de passe doit contenir au moins 6 caractères.");
        return;
      }
      if (pw !== pw2) {
        setErr("Les mots de passe ne correspondent pas.");
        return;
      }
      setErr(null);
      setBusy(true);
      const { error } = await updatePassword(pw);
      setBusy(false);
      if (error) setErr(error);
      else setDone(true);
    };
    return (
      <form onSubmit={save} className="mt-4 space-y-2">
        <p className="text-sm text-slate-600 dark:text-slate-300">Choisis ton nouveau mot de passe.</p>
        <div className="flex gap-2">
          <input
            type={showPw ? "text" : "password"}
            required
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Nouveau mot de passe (min. 6)"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            {showPw ? "Cacher" : "Afficher"}
          </button>
        </div>
        <input
          type={showPw ? "text" : "password"}
          required
          autoComplete="new-password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          placeholder="Confirme le mot de passe"
          className={inputCls}
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "…" : "Mettre à jour le mot de passe"}
        </button>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>
    );
  }

  // Aucune session de récupération : proposer d'(re)envoyer un lien.
  if (sent) {
    return (
      <div className={okCls}>
        ✅ Si un compte existe pour <strong>{email}</strong>, un lien de réinitialisation vient d'être
        envoyé.
      </div>
    );
  }
  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setErr(null);
    setBusy(true);
    const { error } = await resetPassword(email);
    setBusy(false);
    if (error) setErr(error);
    else setSent(true);
  };
  return (
    <form onSubmit={request} className="mt-4 space-y-2">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Le lien a peut-être expiré. Entre ton courriel pour en recevoir un nouveau.
      </p>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="ton@courriel.com"
        className={inputCls}
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "…" : "Envoyer un lien de réinitialisation"}
      </button>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <p className="pt-1 text-xs text-slate-400">
        <Link href="/favoris" className="underline hover:text-brand-600">
          Retour à mon espace
        </Link>
      </p>
    </form>
  );
}
