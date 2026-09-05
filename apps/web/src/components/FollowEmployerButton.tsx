"use client";

import { useState } from "react";
import { cn } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useIsFollowing, toggleFollow } from "@/lib/followed-companies";
import { createAlert, deleteAlert, useAlerts } from "@/lib/alerts";

/**
 * « Suivre une entreprise » : mémorise l'employeur dans ce navigateur et, si
 * l'utilisateur est connecté, crée/supprime une **alerte courriel** limitée à
 * cette source (`{ sources: [slug] }`) — le CI notifie alors chaque nouvelle
 * offre (voir apps/api/src/notify.ts). Sans compte, le suivi reste local.
 */
export function FollowEmployerButton({ slug, name }: { slug: string; name: string }) {
  const following = useIsFollowing(slug);
  const { user, enabled: authEnabled } = useAuth();
  const { alerts, refresh } = useAlerts();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Alerte existante limitée à cet employeur (pour éviter les doublons / retirer).
  const matchingAlert = alerts.find(
    (a) => Array.isArray(a.query.sources) && a.query.sources.length === 1 && a.query.sources[0] === slug,
  );

  const onToggle = async () => {
    const willFollow = toggleFollow(slug);
    setMsg(null);
    if (!authEnabled) return; // pas de comptes configurés : suivi local seulement
    if (!user) {
      setMsg(
        willFollow
          ? "Suivi dans ce navigateur. Connecte-toi pour recevoir un courriel à chaque nouvelle offre."
          : null,
      );
      return;
    }
    setBusy(true);
    try {
      if (willFollow) {
        if (!matchingAlert) {
          const { error } = await createAlert(`Nouvelles offres — ${name}`, { sources: [slug] });
          if (error) throw new Error(error);
          await refresh();
        }
        setMsg("🔔 Tu recevras un courriel quand cette entreprise publiera de nouvelles offres.");
      } else {
        if (matchingAlert) {
          await deleteAlert(matchingAlert.id);
          await refresh();
        }
      }
    } catch (e) {
      setMsg(`Suivi local enregistré, mais l'alerte courriel a échoué : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-pressed={following}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50",
          following
            ? "border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100"
            : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
        )}
      >
        <span className="leading-none">{following ? "✓" : "+"}</span>
        {following ? "Entreprise suivie" : "Suivre cette entreprise"}
      </button>
      {msg && <p className="mt-1.5 text-xs text-slate-600">{msg}</p>}
    </div>
  );
}
