"use client";

import { useEffect, useState } from "react";
import { getSources, type SourceWithMeta } from "@/lib/data";
import { Badge } from "./Badge";

const STATUS = {
  active: { label: "Actif", tone: "green" as const },
  experimental: { label: "Expérimental", tone: "amber" as const },
  planned: { label: "Répertorié", tone: "slate" as const },
};

const REGION_LABEL: Record<string, string> = { QC: "Québec", CA: "Canada", INTL: "International" };
const METHOD_LABEL: Record<string, string> = {
  html: "HTML",
  headless: "Navigateur",
  api: "API",
  rss: "Flux RSS",
};

export function SourcesView() {
  const [sources, setSources] = useState<SourceWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSources()
      .then((r) => setSources(r.sources))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const active = sources.filter((s) => s.status !== "planned");
  const planned = sources.filter((s) => s.status === "planned");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Répertoire des sources</h1>
        <p className="mt-1 max-w-2xl text-slate-600">
          Tous les sites d'emploi surveillés par JobCCQ. Chaque source peut être branchée
          individuellement — celles marquées « Répertorié » attendent leur scraper.
        </p>
      </header>

      {error && (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Impossible de charger les sources : {error}
        </div>
      )}
      {loading && <p className="text-slate-500">Chargement…</p>}

      {active.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Sources connectées
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((s) => (
              <SourceCard key={s.id} source={s} />
            ))}
          </div>
        </section>
      )}

      {planned.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Sites répertoriés (à connecter)
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {planned.map((s) => (
              <SourceCard key={s.id} source={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SourceCard({ source: s }: { source: SourceWithMeta }) {
  const status = STATUS[s.status];
  return (
    <article
      className={`card p-4 ${s.featured ? "ring-2 ring-brand-200" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            {s.name}
            {s.featured && <Badge tone="brand">Principale</Badge>}
          </h3>
          <a
            href={s.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-brand-600 hover:underline"
          >
            {s.homepage.replace(/^https?:\/\//, "")}
          </a>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <p className="mt-2 text-sm text-slate-600">{s.scope}</p>

      {s.sectors && s.sectors.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {s.sectors.map((sec) => (
            <Badge key={sec} tone="amber">
              {sec}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <Badge>{REGION_LABEL[s.region] ?? s.region}</Badge>
        <Badge>{METHOD_LABEL[s.method] ?? s.method}</Badge>
        {s.hasScraper && <Badge tone="green">Scraper prêt</Badge>}
        {s.jobCount > 0 && <Badge tone="brand">{s.jobCount} offres</Badge>}
      </div>
    </article>
  );
}
