"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ccqTradeLabel,
  ccqWageForJob,
  formatCcqHourly,
  extractBenefits,
  extractRequirements,
  labelForEmployment,
  labelForRegion,
  labelForRemote,
  type Job,
} from "@jobccq/shared";
import { formatSalary, timeAgo } from "@/lib/format";
import { getJobById } from "@/lib/data";
import { ApplyLink } from "./ApplyLink";
import {
  COMPARE_MAX,
  clearCompare,
  parseCompareIds,
  removeCompare,
  useCompareIds,
} from "@/lib/compare";

function idsFromLocation(): string[] {
  if (typeof window === "undefined") return [];
  return parseCompareIds(new URLSearchParams(window.location.search).get("ids"));
}

/** Tableau côte à côte (salaire, région, type, exigences…). */
export function CompareView() {
  const stored = useCompareIds();
  const [queryIds, setQueryIds] = useState<string[]>([]);
  const ids = queryIds.length ? queryIds : stored;
  const [jobs, setJobs] = useState<(Job | null)[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setQueryIds(idsFromLocation());
  }, []);

  useEffect(() => {
    if (!ids.length) {
      setJobs([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    Promise.all(ids.map((id) => getJobById(id)))
      .then((list) => {
        if (alive) setJobs(list);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [ids.join(",")]);

  const cols = useMemo(
    () =>
      ids.map((id, i) => ({
        id,
        job: jobs[i] ?? null,
      })),
    [ids, jobs],
  );

  if (!loading && ids.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-500">
        <p className="font-medium text-slate-700">Aucune offre à comparer</p>
        <p className="mt-1 text-sm">
          Sur une fiche ou une carte, clique « Comparer » (jusqu&apos;à {COMPARE_MAX} offres).
        </p>
        <Link href="/emplois" className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
          Voir les offres →
        </Link>
      </div>
    );
  }

  const rows: { label: string; cell: (job: Job) => string }[] = [
    { label: "Employeur", cell: (j) => j.company },
    {
      label: "Lieu",
      cell: (j) => {
        const region = labelForRegion(j.regionId);
        if (j.city && region && !region.toLowerCase().includes(j.city.toLowerCase())) {
          return `${j.city} · ${region}`;
        }
        return j.city ?? region ?? "—";
      },
    },
    { label: "Salaire", cell: (j) => formatSalary(j) ?? "Non renseigné" },
    {
      label: "Grille CCQ",
      cell: (j) => {
        const w = ccqWageForJob(j.title, j);
        return w ? `${w.tradeLabel} · ${formatCcqHourly(w.hourly)}` : "—";
      },
    },
    { label: "Type", cell: (j) => (j.employmentType ? labelForEmployment(j.employmentType) ?? j.employmentType : "—") },
    { label: "Présentiel", cell: (j) => (j.remote ? labelForRemote(j.remote) ?? j.remote : "—") },
    { label: "Métier CCQ", cell: (j) => ccqTradeLabel(j.title) ?? "—" },
    {
      label: "Exigences",
      cell: (j) => {
        const r = extractRequirements(j.title, j.description);
        return r.length ? r.map((x) => x.label).join(" · ") : "—";
      },
    },
    {
      label: "Avantages",
      cell: (j) => {
        const b = extractBenefits(j.title, j.description);
        return b.length ? b.map((x) => x.label).join(" · ") : "—";
      },
    },
    { label: "Publiée", cell: (j) => timeAgo(j.postedAt ?? j.scrapedAt) ?? "—" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {loading ? "Chargement…" : `${cols.filter((c) => c.job).length} offre(s) côte à côte`}
        </p>
        {ids.length > 0 && (
          <button
            type="button"
            onClick={() => {
              clearCompare();
              setQueryIds([]);
            }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Vider la comparaison
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="w-32 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Critère
              </th>
              {cols.map((c) => (
                <th key={c.id} className="min-w-[14rem] px-3 py-3 text-left align-top">
                  {c.job ? (
                    <>
                      <Link href={`/emplois/${c.job.id}/`} className="font-semibold text-slate-900 hover:text-brand-700">
                        {c.job.title}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <ApplyLink job={c.job} className="text-xs font-semibold text-brand-700 hover:underline">
                          Postuler ↗
                        </ApplyLink>
                        <button
                          type="button"
                          onClick={() => {
                            removeCompare(c.id);
                            setQueryIds((cur) => (cur.length ? cur.filter((x) => x !== c.id) : cur));
                          }}
                          className="text-xs text-slate-500 hover:text-red-600"
                        >
                          Retirer
                        </button>
                      </div>
                    </>
                  ) : (
                    <span className="text-slate-400">{loading ? "…" : "Offre indisponible"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-slate-100 last:border-0">
                <th className="px-3 py-2.5 text-left font-medium text-slate-500">{row.label}</th>
                {cols.map((c) => (
                  <td key={c.id} className="px-3 py-2.5 text-slate-800">
                    {c.job ? row.cell(c.job) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ids.length < COMPARE_MAX && (
        <p className="mt-3 text-center text-xs text-slate-400">
          Tu peux encore ajouter {COMPARE_MAX - ids.length} offre
          {COMPARE_MAX - ids.length > 1 ? "s" : ""} depuis une fiche ou une carte.
        </p>
      )}
    </div>
  );
}
