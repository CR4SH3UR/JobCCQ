"use client";

import { useEffect, useState } from "react";
import { sourceName } from "@jobccq/shared";
import { fetchApplyClickStats, type ApplyClickStats } from "@/lib/apply-clicks";

/** Top clics « Postuler » (table Supabase, sinon ce navigateur). */
export function ApplyClicksPanel() {
  const [stats, setStats] = useState<ApplyClickStats | null>(null);
  const [source, setSource] = useState<"supabase" | "local">("local");

  useEffect(() => {
    void fetchApplyClickStats().then((r) => {
      setStats(r.stats);
      setSource(r.source);
    });
  }, []);

  if (!stats) return <p className="text-sm text-slate-500">Chargement des clics…</p>;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-sm font-bold">Clics « Postuler »</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        {stats.total} clic{stats.total > 1 ? "s" : ""} ·{" "}
        {source === "supabase" ? "tous les visiteurs" : "ce navigateur (table distante vide ou RLS)"}
      </p>
      {stats.total === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Aucun clic enregistré pour le moment.</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Par source</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {stats.bySource.slice(0, 8).map((s) => (
                <li key={s.sourceId} className="flex justify-between gap-2">
                  <span className="truncate">{sourceName(s.sourceId)}</span>
                  <span className="font-semibold">{s.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Par offre</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {stats.byJob.slice(0, 8).map((j) => (
                <li key={j.jobId} className="flex justify-between gap-2">
                  <span className="truncate">{j.title}</span>
                  <span className="font-semibold">{j.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
