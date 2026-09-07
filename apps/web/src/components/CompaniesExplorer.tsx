"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  JOB_CATEGORIES,
  QUEBEC_REGIONS,
  isHiringCompanyDisabled,
  labelForCategory,
  labelForRegion,
  type HiringCompany,
} from "@jobccq/shared";
import { searchCompanies, buildQuery, invalidateJobsCache } from "@/lib/data";
import { Badge } from "./Badge";
import { timeAgo } from "@/lib/format";
import { logoForHiringCompany } from "@/lib/logo-url";
import { CompanyAvatar } from "./CompanyAvatar";

function useDebounce<T>(value: T, delay = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function CompaniesExplorer() {
  const [company, setCompany] = useState("");
  const [region, setRegion] = useState("");
  const [category, setCategory] = useState("");
  const [companies, setCompanies] = useState<HiringCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hideDisabled, setHideDisabled] = useState(true);

  const dcompany = useDebounce(company);

  useEffect(() => {
    try {
      const v = localStorage.getItem("entreprises:hide-disabled");
      if (v === "0") setHideDisabled(false);
      if (v === "1") setHideDisabled(true);
    } catch {
      /* stockage indisponible */
    }
  }, []);

  const visibleCompanies = useMemo(
    () => (hideDisabled ? companies.filter((c) => !isHiringCompanyDisabled(c)) : companies),
    [companies, hideDisabled],
  );

  const query = useMemo(
    () =>
      buildQuery({
        company: dcompany || undefined,
        regions: region ? [region] : undefined,
        categories: category ? [category] : undefined,
      }),
    [dcompany, region, category],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    searchCompanies(query)
      .then((r) => alive && setCompanies(r.companies))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [query]);

  // Rafraîchissement forcé : vide les caches (instantané, overlay, ville/région)
  // puis recharge la liste des entreprises.
  const forceRefresh = useCallback(() => {
    invalidateJobsCache();
    setRefreshing(true);
    setError(null);
    searchCompanies(query)
      .then((r) => setCompanies(r.companies))
      .catch((e: Error) => setError(e.message))
      .finally(() => setRefreshing(false));
  }, [query]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="card flex flex-col gap-2 p-3 sm:flex-row sm:p-4">
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Rechercher une entreprise…"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400 sm:w-56"
        >
          <option value="">Toutes les régions</option>
          {QUEBEC_REGIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400 sm:w-56"
        >
          <option value="">Tous les domaines</option>
          {JOB_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <label className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={hideDisabled}
            onChange={(e) => {
              const on = e.target.checked;
              setHideDisabled(on);
              try {
                localStorage.setItem("entreprises:hide-disabled", on ? "1" : "0");
              } catch {
                /* stockage indisponible */
              }
            }}
          />
          Cacher les désactivées
        </label>
        <button
          type="button"
          onClick={forceRefresh}
          disabled={refreshing}
          title="Recharger les entreprises (vide le cache et récupère les derniers changements)"
          aria-label="Rafraîchir les entreprises"
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <span className={refreshing ? "inline-block animate-spin" : "inline-block"}>↻</span>
          <span className="ml-1 hidden sm:inline">{refreshing ? "Rafraîchissement…" : "Rafraîchir"}</span>
        </button>
      </div>

      <p className="mt-4 text-sm text-slate-600">
        {loading ? (
          "Chargement…"
        ) : (
          <>
            <span className="font-semibold text-slate-900">{visibleCompanies.length}</span> entreprise
            {visibleCompanies.length > 1 ? "s" : ""} qui recrutent
            {hideDisabled && companies.length !== visibleCompanies.length ? (
              <span className="text-slate-400">
                {" "}
                · {companies.length - visibleCompanies.length} désactivée
                {companies.length - visibleCompanies.length > 1 ? "s" : ""} masquée
                {companies.length - visibleCompanies.length > 1 ? "s" : ""}
              </span>
            ) : null}
          </>
        )}
      </p>

      {error && (
        <div className="card mt-3 border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Impossible de charger les entreprises : {error}
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCompanies.map((c) => (
          <CompanyCard key={c.company} company={c} />
        ))}
      </div>
    </div>
  );
}

function CompanyCard({ company: c }: { company: HiringCompany }) {
  const latest = timeAgo(c.latestPostedAt);
  return (
    <article className="card flex flex-col p-4">
      <div className="flex items-center gap-3">
        <CompanyAvatar name={c.company} logo={logoForHiringCompany(c)} size={44} />
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{c.company}</h3>
          <p className="text-sm text-brand-700">
            {c.openings} poste{c.openings > 1 ? "s" : ""} ouvert{c.openings > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.categories.slice(0, 3).map((cat) => (
          <Badge key={cat} tone="brand">
            {labelForCategory(cat)}
          </Badge>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {c.regions.slice(0, 3).map((r) => (
          <Badge key={r}>{labelForRegion(r)}</Badge>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between pt-3 text-xs text-slate-400">
        {latest ? <span>Dernière offre {latest}</span> : <span />}
        <Link
          href={c.sources[0] ? `/entreprises/${c.sources[0]}/` : "/emplois"}
          className="font-semibold text-brand-600 hover:underline"
        >
          Voir la fiche →
        </Link>
      </div>
    </article>
  );
}
