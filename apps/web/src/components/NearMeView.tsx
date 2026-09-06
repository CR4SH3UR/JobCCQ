"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  labelForRegion,
  looksLikePostal,
  resolveNearMe,
  type HiringCompany,
  type Municipality,
} from "@jobccq/shared";
import { buildQuery, searchCompanies, searchJobs } from "@/lib/data";
import { fetchMunicipalities } from "@/lib/municipalities";
import { Badge } from "./Badge";
import { logoForHiringCompany } from "@/lib/logo-url";
import { CompanyAvatar } from "./CompanyAvatar";

const LS_NEAR = "jobccq:near-me";

/**
 * « Qui recrute près de chez moi » : code postal (FSA) ou nom de ville →
 * région administrative, puis les employeurs qui embauchent dans cette région.
 */
export function NearMeView() {
  const [input, setInput] = useState("");
  const [towns, setTowns] = useState<Municipality[] | null>(null);
  const [submitted, setSubmitted] = useState("");
  const [companies, setCompanies] = useState<HiringCompany[]>([]);
  const [jobCount, setJobCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMunicipalities()
      .then((list) => alive && setTowns(list))
      .catch(() => alive && setTowns([]));
    try {
      const saved = localStorage.getItem(LS_NEAR);
      if (saved) {
        setInput(saved);
        setSubmitted(saved);
      }
    } catch {
      /* ignore */
    }
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      setInput(q);
      setSubmitted(q);
    }
    return () => {
      alive = false;
    };
  }, []);

  const hit = useMemo(() => {
    if (!submitted) return null;
    if (looksLikePostal(submitted)) return resolveNearMe(submitted, towns ?? []);
    if (!towns) return null;
    return resolveNearMe(submitted, towns);
  }, [submitted, towns]);

  useEffect(() => {
    if (!hit) {
      setCompanies([]);
      setJobCount(0);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    const q = buildQuery({ regions: [hit.regionId], pageSize: 100_000 });
    Promise.all([searchCompanies(q), searchJobs({ ...q, pageSize: 1 })])
      .then(([c, j]) => {
        if (!alive) return;
        setCompanies(c.companies);
        setJobCount(j.total);
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [hit]);

  const go = useCallback(
    (raw: string) => {
      const v = raw.trim();
      setSubmitted(v);
      try {
        v ? localStorage.setItem(LS_NEAR, v) : localStorage.removeItem(LS_NEAR);
      } catch {
        /* ignore */
      }
      const qs = v ? `?q=${encodeURIComponent(v)}` : "";
      window.history.replaceState(null, "", `${window.location.pathname}${qs}`);
    },
    [],
  );

  const regionLabel = hit ? (labelForRegion(hit.regionId) ?? hit.regionId) : null;
  const unknown = submitted.length > 0 && towns && !hit;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(input);
        }}
        className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Code postal (H2X 1Y4) ou ville (Longueuil)"
          aria-label="Code postal ou ville"
          autoComplete="postal-code"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Voir qui recrute
        </button>
      </form>

      {towns === null && <p className="mt-4 text-sm text-slate-500">Chargement de l'index des villes…</p>}

      {unknown && (
        <p className="mt-4 text-sm text-amber-800">
          Impossible de situer « {submitted} ». Essaie un code postal québécois (ex. G1R 4P5) ou le
          nom d'une municipalité.
        </p>
      )}

      {hit && regionLabel && (
        <div className="mt-6">
          <p className="text-sm text-slate-600">
            {hit.via === "postal" ? (
              <>
                Code postal <span className="font-semibold text-slate-800">{hit.fsa}</span>
              </>
            ) : (
              <>
                Ville <span className="font-semibold text-slate-800">{hit.city}</span>
              </>
            )}{" "}
            → région <span className="font-semibold text-slate-800">{regionLabel}</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {loading ? (
              "Recherche des employeurs…"
            ) : (
              <>
                <span className="font-semibold text-slate-800">{companies.length}</span> entreprise
                {companies.length > 1 ? "s" : ""} ·{" "}
                <Link
                  href={`/emplois?regions=${hit.regionId}`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {jobCount} offre{jobCount > 1 ? "s" : ""}
                </Link>
                {" · "}
                <Link
                  href={`/entreprises/region/${hit.regionId}/`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  classement de la région
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      {error && (
        <div className="card mt-4 border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {hit && !loading && companies.length === 0 && !error && (
        <p className="mt-6 text-slate-600">
          Aucun employeur n'a d'offre ouverte dans cette région pour le moment.
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {companies.map((c, i) => {
          return (
            <li key={c.company} className="card flex items-center gap-3 p-3 sm:p-4">
              <span className="w-8 shrink-0 text-right text-sm font-semibold text-slate-400">
                {i + 1}.
              </span>
              <CompanyAvatar name={c.company} logo={logoForHiringCompany(c)} size={40} />
              <Link
                href={c.sources[0] ? `/entreprises/${c.sources[0]}/` : `/emplois?q=${encodeURIComponent(c.company)}`}
                className="min-w-0 flex-1"
              >
                <span className="font-semibold text-slate-900 hover:text-brand-700">{c.company}</span>
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {c.regions.slice(0, 2).map((r) => (
                    <Badge key={r}>{labelForRegion(r)}</Badge>
                  ))}
                </span>
              </Link>
              <span className="shrink-0 text-sm text-brand-700">
                {c.openings} poste{c.openings > 1 ? "s" : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
