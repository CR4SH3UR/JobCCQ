"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  labelForCategory,
  labelForEmployment,
  labelForLanguage,
  labelForRegion,
  labelForRemote,
  sourceName,
  SORT_OPTIONS,
  type JobQuery,
  type JobSearchResult,
  type SortOption,
} from "@jobccq/shared";
import { searchJobs, buildQuery } from "@/lib/data";
import { useLivePoll } from "@/lib/live";
import { JobCard } from "./JobCard";
import { FacetGroup } from "./FacetGroup";
import { Pagination } from "./Pagination";
import { Badge } from "./Badge";
import { SponsorBanner } from "./SponsorBanner";
import { isSponsoredEmployer } from "@/lib/sponsors";
import { cn } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { createAlert, filterQuery } from "@/lib/alerts";

const PAGE_SIZE = 20;

const SORT_LABELS: Record<SortOption, string> = {
  recent: "Plus récentes",
  relevance: "Pertinence",
  salary_desc: "Salaire (élevé → bas)",
  salary_asc: "Salaire (bas → élevé)",
  company: "Entreprise (A → Z)",
};

const POSTED_OPTIONS = [
  { value: "", label: "N'importe quand" },
  { value: "1", label: "Dernières 24 h" },
  { value: "7", label: "7 derniers jours" },
  { value: "14", label: "14 derniers jours" },
  { value: "30", label: "30 derniers jours" },
];

type MultiKey = "regions" | "categories" | "employmentTypes" | "remote" | "sources" | "languages";
const EMPTY_SEL: Record<MultiKey, string[]> = {
  regions: [],
  categories: [],
  employmentTypes: [],
  remote: [],
  sources: [],
  languages: [],
};

function useDebounce<T>(value: T, delay = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function labelFor(key: MultiKey, id: string): string {
  switch (key) {
    case "regions":
      return labelForRegion(id) ?? id;
    case "categories":
      return labelForCategory(id) ?? id;
    case "employmentTypes":
      return labelForEmployment(id) ?? id;
    case "remote":
      return labelForRemote(id) ?? id;
    case "languages":
      return labelForLanguage(id) ?? id;
    case "sources":
      return sourceName(id);
  }
}

export function EmploisExplorer() {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [sel, setSel] = useState<Record<MultiKey, string[]>>(EMPTY_SEL);
  const [salaryMin, setSalaryMin] = useState("");
  const [postedWithinDays, setPostedWithinDays] = useState("");
  const [ccqOnly, setCcqOnly] = useState(false);
  const [sort, setSort] = useState<SortOption>("recent");
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<JobSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const { user, enabled: authEnabled } = useAuth();
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  // Amorce les filtres depuis l'URL (liens profonds depuis l'accueil).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const iq = sp.get("q");
    const ic = sp.get("cities");
    const icat = sp.get("categories");
    const ireg = sp.get("regions");
    const isrc = sp.get("sources");
    if (iq) setQ(iq);
    if (ic) setCity(ic);
    if (icat || ireg || isrc) {
      setSel((s) => ({
        ...s,
        categories: icat ? icat.split(",") : s.categories,
        regions: ireg ? ireg.split(",") : s.regions,
        sources: isrc ? isrc.split(",") : s.sources,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dq = useDebounce(q);
  const dcity = useDebounce(city);

  const query = useMemo<JobQuery>(
    () =>
      buildQuery({
        q: dq || undefined,
        cities: dcity ? [dcity] : undefined,
        regions: sel.regions.length ? sel.regions : undefined,
        categories: sel.categories.length ? sel.categories : undefined,
        employmentTypes: sel.employmentTypes.length ? sel.employmentTypes : undefined,
        remote: sel.remote.length ? (sel.remote as JobQuery["remote"]) : undefined,
        sources: sel.sources.length ? sel.sources : undefined,
        languages: sel.languages.length ? (sel.languages as JobQuery["languages"]) : undefined,
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        postedWithinDays: postedWithinDays ? Number(postedWithinDays) : undefined,
        ccqOnly: ccqOnly || undefined,
        sort,
        page,
        pageSize: PAGE_SIZE,
      }),
    [dq, dcity, sel, salaryMin, postedWithinDays, ccqOnly, sort, page],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    searchJobs(query)
      .then((r) => alive && setResult(r))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [query]);

  // Rafraîchissement silencieux (polling + notification admin cross-onglet).
  const refresh = useCallback(() => {
    searchJobs(query)
      .then((r) => setResult(r))
      .catch(() => {});
  }, [query]);
  useLivePoll(refresh);

  const toggle = (key: MultiKey, id: string) => {
    setPage(1);
    setSel((s) => {
      const has = s[key].includes(id);
      return { ...s, [key]: has ? s[key].filter((x) => x !== id) : [...s[key], id] };
    });
  };

  const resetAll = () => {
    setQ("");
    setCity("");
    setSel(EMPTY_SEL);
    setSalaryMin("");
    setPostedWithinDays("");
    setCcqOnly(false);
    setSort("recent");
    setPage(1);
  };

  const activeCount =
    Object.values(sel).reduce((n, a) => n + a.length, 0) +
    (q ? 1 : 0) +
    (city ? 1 : 0) +
    (salaryMin ? 1 : 0) +
    (postedWithinDays ? 1 : 0) +
    (ccqOnly ? 1 : 0);

  // Libellé lisible de la recherche courante (pour nommer une alerte).
  const alertLabel = (): string => {
    const parts: string[] = [];
    if (dq) parts.push(`« ${dq} »`);
    if (dcity) parts.push(dcity);
    sel.categories.forEach((id) => parts.push(labelForCategory(id) ?? id));
    sel.regions.forEach((id) => parts.push(labelForRegion(id) ?? id));
    return parts.join(" · ") || "Toutes les offres";
  };

  const onCreateAlert = async () => {
    if (!user) {
      setAlertMsg("Connecte-toi (bouton « Se connecter » en haut) pour créer une alerte.");
      return;
    }
    setAlertMsg("Création…");
    const { error: e } = await createAlert(alertLabel(), filterQuery(query));
    setAlertMsg(
      e
        ? `Erreur : ${e}`
        : "✅ Alerte créée — tu recevras un courriel quand de nouvelles offres correspondront.",
    );
  };

  const facets = result?.facets;

  // Offres « en vedette » (commanditées) remontées en tête de la page courante.
  const items = useMemo(() => {
    if (!result) return [];
    return [...result.items].sort(
      (a, b) => Number(isSponsoredEmployer(b.sourceId)) - Number(isSponsoredEmployer(a.sourceId)),
    );
  }, [result]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Barre de recherche + tri */}
      <div className="card p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              🔎
            </span>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Poste, mot-clé, entreprise…"
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <input
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPage(1);
            }}
            placeholder="Ville (ex. Montréal)"
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-56"
          />
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortOption);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
          {authEnabled && (
            <button
              type="button"
              onClick={onCreateAlert}
              title="Recevoir un courriel quand de nouvelles offres correspondent à cette recherche"
              className="rounded-lg border border-brand-300 px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              🔔 Créer une alerte
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium lg:hidden"
          >
            Filtres{activeCount > 0 ? ` (${activeCount})` : ""}
          </button>
        </div>

        {/* Chips de filtres actifs */}
        {activeCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {q && <Chip onClear={() => setQ("")}>« {q} »</Chip>}
            {city && <Chip onClear={() => setCity("")}>📍 {city}</Chip>}
            {(Object.keys(sel) as MultiKey[]).flatMap((k) =>
              sel[k].map((id) => (
                <Chip key={`${k}-${id}`} onClear={() => toggle(k, id)}>
                  {labelFor(k, id)}
                </Chip>
              )),
            )}
            {salaryMin && <Chip onClear={() => setSalaryMin("")}>≥ {salaryMin} $/an</Chip>}
            {postedWithinDays && (
              <Chip onClear={() => setPostedWithinDays("")}>
                {POSTED_OPTIONS.find((o) => o.value === postedWithinDays)?.label}
              </Chip>
            )}
            {ccqOnly && <Chip onClear={() => setCcqOnly(false)}>Métiers CCQ</Chip>}
            <button
              type="button"
              onClick={resetAll}
              className="ml-1 text-xs font-medium text-slate-500 hover:text-slate-800 hover:underline"
            >
              Tout effacer
            </button>
          </div>
        )}
        {alertMsg && <p className="mt-2 text-xs text-slate-600">{alertMsg}</p>}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[260px_1fr]">
        {/* Colonne filtres */}
        <aside className={cn("lg:block", showFilters ? "block" : "hidden")}>
          <div className="card p-3">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Filtrer</h3>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={resetAll}
                  className="text-xs text-brand-600 hover:underline"
                >
                  Réinitialiser
                </button>
              )}
            </div>

            {/* Métiers CCQ */}
            <label className="flex cursor-pointer items-center gap-2 border-b border-slate-100 py-3">
              <input
                type="checkbox"
                checked={ccqOnly}
                onChange={(e) => {
                  setCcqOnly(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-300"
              />
              <span className="text-sm font-medium text-slate-700">
                Métiers CCQ seulement
                <span className="mt-0.5 block text-xs font-normal text-slate-400">
                  Métiers reconnus des conventions (électricien, charpentier…)
                </span>
              </span>
            </label>

            {/* Salaire */}
            <div className="border-b border-slate-100 py-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Salaire annuel min.
              </h4>
              <input
                type="number"
                min={0}
                step={5000}
                value={salaryMin}
                onChange={(e) => {
                  setSalaryMin(e.target.value);
                  setPage(1);
                }}
                placeholder="ex. 60000"
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
              />
            </div>

            {/* Date de publication */}
            <div className="border-b border-slate-100 py-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Publié depuis
              </h4>
              <select
                value={postedWithinDays}
                onChange={(e) => {
                  setPostedWithinDays(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
              >
                {POSTED_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {facets && (
              <>
                <FacetGroup title="Domaine" options={facets.categories} selected={sel.categories} onToggle={(id) => toggle("categories", id)} />
                <FacetGroup title="Région" options={facets.regions} selected={sel.regions} onToggle={(id) => toggle("regions", id)} />
                <FacetGroup title="Type de poste" options={facets.employmentTypes} selected={sel.employmentTypes} onToggle={(id) => toggle("employmentTypes", id)} />
                <FacetGroup title="Mode de travail" options={facets.remote} selected={sel.remote} onToggle={(id) => toggle("remote", id)} />
                <FacetGroup title="Langue" options={facets.languages} selected={sel.languages} onToggle={(id) => toggle("languages", id)} />
                <FacetGroup title="Source" options={facets.sources} selected={sel.sources} onToggle={(id) => toggle("sources", id)} />
              </>
            )}
          </div>
        </aside>

        {/* Colonne résultats */}
        <section>
          <SponsorBanner className="mb-4" />
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              {loading && !result ? (
                "Chargement…"
              ) : result ? (
                <>
                  <span className="font-semibold text-slate-900">{result.total}</span> offre
                  {result.total > 1 ? "s" : ""}
                </>
              ) : null}
            </p>
            {loading && result && <span className="text-xs text-slate-400">Mise à jour…</span>}
          </div>

          {error && (
            <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Impossible de charger les offres : {error}
              <p className="mt-1 text-red-500">
                Vérifie que l'API est démarrée (npm run dev:api) et que NEXT_PUBLIC_API_URL est
                correcte.
              </p>
            </div>
          )}

          {result && result.items.length === 0 && !error && (
            <div className="card p-8 text-center text-slate-500">
              Aucune offre ne correspond à ces critères.
              {activeCount > 0 && (
                <button onClick={resetAll} className="mt-2 block w-full text-brand-600 hover:underline">
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          )}

          <div className="space-y-3">
            {items.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>

          {result && (
            <Pagination page={result.page} totalPages={result.totalPages} onChange={setPage} />
          )}
        </section>
      </div>
    </div>
  );
}

function Chip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <Badge tone="brand" className="gap-1 pr-1">
      {children}
      <button
        type="button"
        onClick={onClear}
        className="ml-0.5 grid h-4 w-4 place-items-center rounded-full text-brand-500 hover:bg-brand-100"
        aria-label="Retirer le filtre"
      >
        ×
      </button>
    </Badge>
  );
}
