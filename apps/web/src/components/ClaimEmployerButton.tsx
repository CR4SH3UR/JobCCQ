"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { fetchMyClaims, submitClaim, type EmployerClaim } from "@/lib/employer-claims";
import { labelForClaimStatus } from "@jobccq/shared";

/** Réclamer la fiche depuis la page publique de l'employeur. */
export function ClaimEmployerButton({ employerId, name }: { employerId: string; name: string }) {
  const { user, enabled } = useAuth();
  const [mine, setMine] = useState<EmployerClaim | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    void fetchMyClaims(user.id).then((list) => {
      setMine(list.find((c) => c.employerId === employerId) ?? null);
    });
  }, [user, employerId]);

  if (!enabled) return null;

  if (mine) {
    return (
      <p className="text-sm text-slate-600">
        Réclamation {labelForClaimStatus(mine.status).toLowerCase()}.{" "}
        <Link href="/employeur/" className="font-medium text-brand-700 hover:underline">
          Espace employeur
        </Link>
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (!user) {
            setMsg("Connecte-toi (en haut) pour réclamer cette fiche.");
            return;
          }
          setBusy(true);
          setMsg("");
          try {
            const c = await submitClaim(employerId, user.id);
            setMine(c);
            setMsg(`Demande envoyée pour ${name}. Un admin validera.`);
          } catch (e) {
            setMsg(e instanceof Error ? e.message : "Envoi impossible");
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        Réclamer cette fiche
      </button>
      {msg && <p className="mt-1 text-xs text-slate-500">{msg}</p>}
    </div>
  );
}
