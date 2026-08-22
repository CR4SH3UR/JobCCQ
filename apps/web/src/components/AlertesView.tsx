"use client";

import { useState } from "react";
import Link from "next/link";
import {
  labelForCategory,
  labelForEmployment,
  labelForRegion,
  labelForRemote,
  sourceName,
  type JobQuery,
} from "@jobccq/shared";
import { useAuth } from "@/lib/auth";
import { useAlerts, deleteAlert, type JobAlert } from "@/lib/alerts";

/** Résumé lisible des critères d'une alerte. */
function describe(query: Partial<JobQuery>): string {
  const parts: string[] = [];
  if (query.q) parts.push(`« ${query.q} »`);
  if (query.cities?.length) parts.push(query.cities.join(", "));
  query.regions?.forEach((id) => parts.push(labelForRegion(id) ?? id));
  query.categories?.forEach((id) => parts.push(labelForCategory(id) ?? id));
  query.employmentTypes?.forEach((id) => parts.push(labelForEmployment(id) ?? id));
  query.remote?.forEach((id) => parts.push(labelForRemote(id) ?? id));
  query.languages?.forEach((id) => parts.push(String(id).toUpperCase()));
  query.sources?.forEach((id) => parts.push(sourceName(id)));
  if (query.salaryMin != null) parts.push(`≥ ${query.salaryMin} $/an`);
  return parts.join(" · ") || "Toutes les nouvelles offres";
}

export function AlertesView() {
  const { user, loading: authLoading, enabled } = useAuth();
  const { alerts, loading, refresh } = useAlerts();
  const [busy, setBusy] = useState<string | null>(null);

  const remove = async (id: string) => {
    setBusy(id);
    await deleteAlert(id);
    await refresh();
    setBusy(null);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {!enabled ? (
        <div className="card p-6 text-center text-slate-500">
          Les alertes par courriel ne sont pas encore activées sur ce site.
        </div>
      ) : authLoading ? (
        <p className="text-slate-500">Chargement…</p>
      ) : !user ? (
        <div className="card p-8 text-center text-slate-500">
          <div className="mb-2 text-3xl">🔔</div>
          <p className="font-medium text-slate-700">Connecte-toi pour gérer tes alertes</p>
          <p className="mt-1 text-sm">
            Utilise le bouton <strong>« Se connecter »</strong> en haut, puis crée une alerte depuis la page
            des offres.
          </p>
          <Link
            href="/emplois"
            className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Voir les offres →
          </Link>
        </div>
      ) : loading ? (
        <p className="text-slate-500">Chargement…</p>
      ) : alerts.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          <div className="mb-2 text-3xl">🔔</div>
          <p className="font-medium text-slate-700">Aucune alerte pour l'instant</p>
          <p className="mt-1 text-sm">
            Sur la page des offres, fais une recherche puis clique sur{" "}
            <strong>« 🔔 Créer une alerte »</strong>. Tu recevras un courriel quand de nouvelles offres y
            correspondront.
          </p>
          <Link
            href="/emplois"
            className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Créer une alerte →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="mb-1 text-sm text-slate-600">
            {alerts.length} alerte{alerts.length > 1 ? "s" : ""} · un courriel part quand de nouvelles offres
            correspondent.
          </p>
          {alerts.map((a: JobAlert) => (
            <article key={a.id} className="card flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-slate-900">{a.label || "Alerte"}</h3>
                <p className="truncate text-sm text-slate-500">{describe(a.query)}</p>
              </div>
              <button
                onClick={() => remove(a.id)}
                disabled={busy === a.id}
                className="shrink-0 rounded-lg border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {busy === a.id ? "…" : "Supprimer"}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
