"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  labelForCategory,
  labelForEmployment,
  labelForLanguage,
  labelForRegion,
  labelForRemote,
  sourceName,
  CCQ_TRADES,
  SORT_OPTIONS,
  type JobQuery,
  type JobSearchResult,
  type SortOption,
  type SuggestEntry,
  jobsToRss,
} from "@jobccq/shared";
import { searchJobs, buildQuery, invalidateJobsCache, getSearchVocabulary } from "@/lib/data";
import { useLivePoll } from "@/lib/live";
import {
  filtersToQueryString,
  hasActiveFilters,
  parseFilters,
  parseFiltersFromQueryString,
  type SearchFilters,
} from "@/lib/search-url";
import { useSavedSearches } from "@/lib/saved-searches";
import { JobCard } from "./JobCard";
import { SearchAutocomplete } from "./SearchAutocomplete";
import { FacetGroup } from "./FacetGroup";
import { Pagination } from "./Pagination";
import { Badge } from "./Badge";
import { SponsorBanner } from "./SponsorBanner";
import { isSponsoredEmployer } from "@/lib/sponsors";
import { cn } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { createAlert, filterQuery } from "@/lib/alerts";
import { siteUrl } from "@/lib/site";

const PAGE_SIZE = 20;

// Métiers proposés à l'autocomplétion : les métiers reconnus CCQ (le vocabulaire
// des synonymes fait le reste côté recherche, ex. « charpentier » ↔ « menuisier »).
const METIER_ENTRIES: SuggestEntry[] = CCQ_TRADES.map((t) => ({ value: t.label, kind: "metier" as const }));

const SORT_LABELS: Record<SortOption, string> = {
  recent: "Plus récentes",
  relevance: "Pertinence",
  salary_desc: "Salaire (élevé → bas)",
  salary_asc: "Salaire (bas → élevé)",
  company: "Entreprise (A → Z)",
};

const POSTED_OPTIONS = [
  { value: "", label: "N'importe quand" },
  { value: "visit", label: "Depuis ma dernière visite" },
  { value: "1", label: "Dernières 24 h" },
  { value: "7", label: "7 derniers jours" },
  { value: "14", label: "14 derniers jours" },
  { value: "30", label: "30 derniers jours" },
];

const LS_LAST_VISIT = "jobccq:last-visit";

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
  const [salaryListed, setSalaryListed] = useState(false);
  const [postedWithinDays, setPostedWithinDays] = useState("");
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const [ccqOnly, setCcqOnly] = useState(false);
  const [sort, setSort] = useState<SortOption>("recent");
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<JobSearchResult | null>(null);
  const [vocab, setVocab] = useState<{ companies: string[]; cities: string[] }>({ companies: [], cities: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const { user, enabled: authEnabled } = useAuth();
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  // Applique un état de filtres complet à l'UI (amorçage URL, recherche
  // enregistrée). `page` par défaut à 1 sauf indication contraire.
  const applyFilters = useCallback((f: SearchFilters) => {
    setQ(f.q);
    setCity(f.city);
    setSel({
      regions: f.regions,
      categories: f.categories,
      employmentTypes: f.employmentTypes,
      remote: f.remote,
      sources: f.sources,
      languages: f.languages,
    });
    setSalaryMin(f.salaryMin);
    setSalaryListed(f.salaryListed);
    setPostedWithinDays(f.postedWithinDays);
    setCcqOnly(f.ccqOnly);
    setSort(f.sort);
    setPage(f.page);
  }, []);

  // Amorce les filtres depuis l'URL (liens profonds : accueil, pages SEO,
  // URL partagée). On note l'amorçage pour n'écrire l'URL qu'ensuite.
  const seededRef = useRef(false);
  useEffect(() => {
    applyFilters(parseFilters(new URLSearchParams(window.location.search)));
    seededRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mémorise l'instant de cette visite pour le filtre « nouveautés » de la prochaine.
  useEffect(() => {
    try {
      setLastVisit(localStorage.getItem(LS_LAST_VISIT));
    } catch {
      /* ignore */
    }
    return () => {
      try {
        localStorage.setItem(LS_LAST_VISIT, new Date().toISOString());
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Vocabulaire d'autocomplétion (entreprises + villes) — chargé une fois.
  useEffect(() => {
    let alive = true;
    getSearchVocabulary()
      .then((v) => alive && setVocab(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Suggestions du champ mot-clé : métiers + entreprises. Champ ville : villes.
  const keywordEntries = useMemo<SuggestEntry[]>(
    () => [...METIER_ENTRIES, ...vocab.companies.map((c) => ({ value: c, kind: "entreprise" as const }))],
    [vocab.companies],
  );
  const cityEntries = useMemo<SuggestEntry[]>(
    () => vocab.cities.map((c) => ({ value: c, kind: "ville" as const })),
    [vocab.cities],
  );

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
        salaryListed: salaryListed || undefined,
        postedWithinDays:
          postedWithinDays && postedWithinDays !== "visit" ? Number(postedWithinDays) : undefined,
        postedSince: postedWithinDays === "visit" && lastVisit ? lastVisit : undefined,
        ccqOnly: ccqOnly || undefined,
        sort,
        page,
        pageSize: PAGE_SIZE,
      }),
    [dq, dcity, sel, salaryMin, salaryListed, postedWithinDays, lastVisit, ccqOnly, sort, page],
  );

  // État des filtres courant (immédiat) — pour enregistrer une recherche et
  // détecter les filtres actifs.
  const currentFilters = useMemo<SearchFilters>(
    () => ({
      q,
      city,
      regions: sel.regions,
      categories: sel.categories,
      employmentTypes: sel.employmentTypes,
      remote: sel.remote,
      sources: sel.sources,
      languages: sel.languages,
      salaryMin,
      salaryListed,
      postedWithinDays,
      ccqOnly,
      sort,
      page,
    }),
    [q, city, sel, salaryMin, salaryListed, postedWithinDays, ccqOnly, sort, page],
  );

  // URL partageable : on reflète les filtres (débounce sur mot-clé/ville) dans la
  // query string via `replaceState` (pas d'entrée d'historique ni de scroll).
  const urlQs = useMemo(
    () => filtersToQueryString({ ...currentFilters, q: dq, city: dcity }),
    [currentFilters, dq, dcity],
  );
  useEffect(() => {
    if (!seededRef.current) return;
    const base = window.location.pathname;
    window.history.replaceState(null, "", urlQs ? `${base}?${urlQs}` : base);
  }, [urlQs]);

  // Recherches enregistrées (localStorage, ce navigateur).
  const { searches: savedSearches, save: saveSearch, remove: removeSearch } = useSavedSearches();

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

  // Rafraîchissement forcé (bouton) : vide les caches (instantané, overlay des
  // éditions, ville/région) puis recharge — pour voir tout de suite les derniers
  // changements sans attendre le polling ni recharger la page.
  const [refreshing, setRefreshing] = useState(false);
  const forceRefresh = useCallback(() => {
    invalidateJobsCache();
    setRefreshing(true);
    searchJobs(query)
      .then((r) => setResult(r))
      .catch((e: Error) => setError(e.message))
      .finally(() => setRefreshing(false));
  }, [query]);

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
    setSalaryListed(false);
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
    (salaryListed ? 1 : 0) +
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

  // Enregistre la recherche courante (nom demandé à l'utilisateur).
  const onSaveSearch = () => {
    if (!hasActiveFilters(currentFilters)) return;
    const name = window.prompt("Nom de cette recherche enregistrée :", alertLabel());
    if (name && name.trim()) saveSearch(name, filtersToQueryString(currentFilters));
  };

  const onDownloadRss = async () => {
    const r = await searchJobs(buildQuery({ ...query, page: 1, pageSize: 50 }));
    const xml = jobsToRss(r.items, {
      siteUrl: siteUrl("/").replace(/\/$/, ""),
      feedUrl: siteUrl(urlQs ? `/emplois/?${urlQs}` : "/emplois.rss"),
      title: `JobCCQc — ${alertLabel()}`,
    });
    const blob = new Blob([xml], { type: "application/rss+xml;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "jobccq-recherche.rss";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Rejoue une recherche enregistrée (repart page 1).
  const onApplySaved = (qs: string) => {
    applyFilters({ ...parseFiltersFromQueryString(qs), page: 1 });
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
          <div className="flex-1">
            <SearchAutocomplete
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(1);
              }}
              entries={keywordEntries}
              placeholder="Poste, métier, entreprise…"
              icon="🔎"
              ariaLabel="Poste, métier ou entreprise"
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div className="sm:w-56">
            <SearchAutocomplete
              value={city}
              onChange={(v) => {
                setCity(v);
                setPage(1);
              }}
              entries={cityEntries}
              placeholder="Ville (ex. Montréal)"
              ariaLabel="Ville"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
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
          <button
            type="button"
            onClick={forceRefresh}
            disabled={refreshing}
            title="Recharger les offres (vide le cache et récupère les derniers changements)"
            aria-label="Rafraîchir les offres"
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <span className={refreshing ? "inline-block animate-spin" : "inline-block"}>↻</span>
            <span className="ml-1 hidden sm:inline">{refreshing ? "Rafraîchissement…" : "Rafraîchir"}</span>
          </button>
          <button
            type="button"
            onClick={() => void onDownloadRss()}
            title="Télécharger un flux RSS de cette recherche (50 offres)"
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            RSS
          </button>
          <button
            type="button"
            onClick={onSaveSearch}
            disabled={!hasActiveFilters(currentFilters)}
            title="Enregistrer cette combinaison de filtres (dans ce navigateur)"
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            💾<span className="ml-1 hidden sm:inline">Enregistrer</span>
          </button>
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
            {salaryListed && <Chip onClear={() => setSalaryListed(false)}>Salaire affiché</Chip>}
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
        {/* Recherches enregistrées (ce navigateur) */}
        {savedSearches.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
            <span className="text-xs font-medium text-slate-500">💾 Mes recherches :</span>
            {savedSearches.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1 text-xs"
              >
                <button
                  type="button"
                  onClick={() => onApplySaved(s.query)}
                  className="font-medium text-slate-700 hover:text-brand-700 hover:underline"
                  title="Appliquer cette recherche"
                >
                  {s.name}
                </button>
                <button
                  type="button"
                  onClick={() => removeSearch(s.id)}
                  aria-label={`Supprimer la recherche « ${s.name} »`}
                  className="rounded-full px-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  ×
                </button>
              </span>
            ))}
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
              <label className="mt-2 flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={salaryListed}
                  onChange={(e) => {
                    setSalaryListed(e.target.checked);
                    setPage(1);
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-300"
                />
                <span className="text-sm font-medium text-slate-700">Salaire renseigné uniquement</span>
              </label>
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
                {POSTED_OPTIONS.filter((o) => o.value !== "visit" || lastVisit).map((o) => (
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
