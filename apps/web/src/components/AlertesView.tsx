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
import { useAlerts, deleteAlert, updateAlert, type JobAlert } from "@/lib/alerts";

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
  if (query.near) parts.push(`≤ ${query.radiusKm ?? 50} km de ${query.near}`);
  return parts.join(" · ") || "Toutes les nouvelles offres";
}

const FREQ: { id: "instant" | "daily" | "weekly"; label: string }[] = [
  { id: "instant", label: "Après chaque scrape" },
  { id: "daily", label: "Quotidien" },
  { id: "weekly", label: "Hebdomadaire" },
];

export function AlertesView() {
  const { user, loading: authLoading, enabled } = useAuth();
  const { alerts, loading, refresh } = useAlerts();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async (id: string) => {
    setBusy(id);
    setError(null);
    await deleteAlert(id);
    await refresh();
    setBusy(null);
  };

  const patchQuery = async (a: JobAlert, patch: Partial<JobQuery>) => {
    setBusy(a.id);
    setError(null);
    const next: Partial<JobQuery> = { ...a.query, ...patch };
    if ("ntfyTopic" in patch && !patch.ntfyTopic) delete next.ntfyTopic;
    if ("webhookUrl" in patch && !patch.webhookUrl) delete next.webhookUrl;
    const { error: err } = await updateAlert(a.id, { query: next });
    if (err) setError(err);
    await refresh();
    setBusy(null);
  };

  return (
    <div>
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
            {alerts.length} alerte{alerts.length > 1 ? "s" : ""} · courriel, webhook et/ou ntfy.
          </p>
          {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
          {alerts.map((a: JobAlert) => (
            <article key={a.id} className="card space-y-2 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-900">
                    {a.label || "Alerte"}
                    {a.query.alertPaused ? (
                      <span className="ml-2 text-xs font-medium text-amber-700">en pause</span>
                    ) : null}
                  </h3>
                  <p className="truncate text-sm text-slate-500">{describe(a.query)}</p>
                </div>
                <button
                  onClick={() => remove(a.id)}
                  disabled={busy === a.id}
                  className="shrink-0 rounded-lg border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {busy === a.id ? "…" : "Supprimer"}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="flex items-center gap-1 text-slate-600">
                  Fréquence
                  <select
                    value={a.query.alertFrequency ?? "instant"}
                    disabled={busy === a.id}
                    onChange={(e) =>
                      void patchQuery(a, { alertFrequency: e.target.value as JobQuery["alertFrequency"] })
                    }
                    className="rounded border border-slate-200 px-1.5 py-1"
                  >
                    {FREQ.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy === a.id}
                  onClick={() => void patchQuery(a, { alertPaused: !a.query.alertPaused })}
                  className="rounded border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
                >
                  {a.query.alertPaused ? "Reprendre" : "Mettre en pause"}
                </button>
                <label className="flex min-w-[12rem] flex-1 items-center gap-1 text-slate-600">
                  Webhook
                  <input
                    key={`${a.id}-hook-${a.query.webhookUrl ?? ""}`}
                    type="url"
                    defaultValue={a.query.webhookUrl ?? ""}
                    placeholder="https://discord.com/api/webhooks/…"
                    disabled={busy === a.id}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (a.query.webhookUrl ?? "")) void patchQuery(a, { webhookUrl: v || undefined });
                    }}
                    className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-1"
                  />
                </label>
                <label className="flex min-w-[10rem] flex-1 items-center gap-1 text-slate-600">
                  ntfy
                  <input
                    key={`${a.id}-ntfy-${a.query.ntfyTopic ?? ""}`}
                    type="text"
                    defaultValue={a.query.ntfyTopic ?? ""}
                    placeholder="topic ou https://ntfy.sh/…"
                    disabled={busy === a.id}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (a.query.ntfyTopic ?? "")) void patchQuery(a, { ntfyTopic: v || undefined });
                    }}
                    className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-1"
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
