"use client";

import { useEffect, useState } from "react";
import { FAILING_ALERT_DAYS, failingScrapers, type FailingSource } from "@jobccq/shared";
import { API_URL, STATIC, adminFetch, getStats } from "@/lib/data";
import { ensureTursoAdminColumns, tursoCreds, tursoRows } from "@/lib/admin-turso";
import { ApplyClicksPanel } from "./ApplyClicksPanel";

type DiffEntry = { title?: string; url?: string };
type RunDiff = { added?: DiffEntry[]; changed?: DiffEntry[]; removed?: DiffEntry[] };

type DashRun = {
  id: number;
  sourceId: string;
  name: string;
  status: string;
  found: number;
  inserted: number;
  updated: number;
  error?: string;
  at: string | null;
  diff?: RunDiff;
};

type DashData = {
  totalJobs: number;
  totalEmployers: number;
  enabledEmployers: number;
  verifiedEmployers: number;
  neverScraped: number;
  errorCount: number;
  failingSources: FailingSource[];
  topSources: { id: string; name: string; count: number }[];
  recentRuns: DashRun[];
  source: "api" | "turso" | "static";
};

function relTime(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

function parseDiff(raw: unknown): RunDiff | undefined {
  if (!raw) return undefined;
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!v || typeof v !== "object") return undefined;
    return v as RunDiff;
  } catch {
    return undefined;
  }
}

async function loadFromTurso(): Promise<DashData | null> {
  const creds = tursoCreds();
  if (!creds) return null;
  await ensureTursoAdminColumns(creds.url, creds.token);
  const n = async (sql: string) => Number((await tursoRows(creds.url, creds.token, sql))[0]?.n ?? 0);
  const [totalJobs, totalEmployers, enabledEmployers, verifiedEmployers, bySource, runs, employers, scraped, latest, lastOk] =
    await Promise.all([
      n("SELECT COUNT(*) AS n FROM Job"),
      n("SELECT COUNT(*) AS n FROM Employer"),
      n("SELECT COUNT(*) AS n FROM Employer WHERE enabled=1"),
      n("SELECT COUNT(*) AS n FROM Employer WHERE verified=1"),
      tursoRows(creds.url, creds.token, "SELECT sourceId, COUNT(*) AS n FROM Job GROUP BY sourceId ORDER BY n DESC LIMIT 10"),
      tursoRows(
        creds.url,
        creds.token,
        "SELECT id, sourceId, status, found, inserted, updated, error, finishedAt, startedAt, diffJson FROM ScrapeRun ORDER BY id DESC LIMIT 25",
      ).catch(() =>
        tursoRows(
          creds.url,
          creds.token,
          "SELECT id, sourceId, status, found, inserted, updated, error, finishedAt, startedAt FROM ScrapeRun ORDER BY id DESC LIMIT 25",
        ),
      ),
      tursoRows(creds.url, creds.token, "SELECT id, name FROM Employer"),
      tursoRows(creds.url, creds.token, "SELECT DISTINCT sourceId FROM ScrapeRun"),
      tursoRows(
        creds.url,
        creds.token,
        `SELECT s.sourceId, s.status, s.error, s.finishedAt, s.startedAt
         FROM ScrapeRun s
         INNER JOIN (SELECT sourceId, MAX(id) AS mid FROM ScrapeRun GROUP BY sourceId) t ON s.id = t.mid`,
      ).catch(() => []),
      tursoRows(
        creds.url,
        creds.token,
        "SELECT sourceId, MAX(finishedAt) AS lastOk FROM ScrapeRun WHERE status='success' GROUP BY sourceId",
      ).catch(() => []),
    ]);
  const nameById = Object.fromEntries(employers.map((e) => [String(e.id), String(e.name)]));
  const lastSuccess = new Map(
    lastOk
      .filter((r) => r.lastOk)
      .map((r) => [String(r.sourceId), String(r.lastOk)]),
  );
  const toAt = (r: Record<string, unknown>) =>
    r.finishedAt ? String(r.finishedAt) : r.startedAt ? String(r.startedAt) : null;
  return {
    totalJobs,
    totalEmployers,
    enabledEmployers,
    verifiedEmployers,
    neverScraped: Math.max(0, totalEmployers - scraped.length),
    errorCount: runs.filter((r) => String(r.status) === "error").length,
    failingSources: failingScrapers(
      latest.map((r) => ({
        sourceId: String(r.sourceId),
        status: String(r.status ?? ""),
        at: toAt(r),
        error: r.error ? String(r.error) : undefined,
      })),
      lastSuccess,
      nameById,
    ),
    topSources: bySource.map((s) => ({
      id: String(s.sourceId),
      name: nameById[String(s.sourceId)] ?? String(s.sourceId),
      count: Number(s.n),
    })),
    recentRuns: runs.map((r) => ({
      id: Number(r.id),
      sourceId: String(r.sourceId),
      name: nameById[String(r.sourceId)] ?? String(r.sourceId),
      status: String(r.status ?? ""),
      found: Number(r.found ?? 0),
      inserted: Number(r.inserted ?? 0),
      updated: Number(r.updated ?? 0),
      error: r.error ? String(r.error) : undefined,
      at: r.finishedAt ? String(r.finishedAt) : r.startedAt ? String(r.startedAt) : null,
      diff: parseDiff(r.diffJson),
    })),
    source: "turso",
  };
}

export function AdminDashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(undefined);
    try {
      if (!STATIC) {
        try {
          const r = await adminFetch(`${API_URL}/admin/dashboard`);
          if (r.ok) {
            const d = (await r.json()) as DashData;
            setData({ ...d, source: "api", failingSources: d.failingSources ?? [] });
            return;
          }
        } catch {
          /* repli Turso / snapshot */
        }
      }
      const fromTurso = await loadFromTurso();
      if (fromTurso) {
        setData(fromTurso);
        return;
      }
      const stats = await getStats();
      setData({
        totalJobs: stats.totalJobs,
        totalEmployers: stats.totalCompanies,
        enabledEmployers: stats.totalCompanies,
        verifiedEmployers: 0,
        neverScraped: 0,
        errorCount: 0,
        failingSources: [],
        topSources: (stats.bySource ?? []).slice(0, 10).map((s) => ({ id: s.id, name: s.id, count: s.count })),
        recentRuns: [],
        source: "static",
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <p className="text-sm text-slate-500">Chargement du tableau de bord…</p>;
  if (error) return <p className="text-sm text-red-600">Erreur : {error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Aucune donnée.</p>;

  const kpis = [
    { label: "Offres", value: data.totalJobs },
    { label: "Employeurs", value: data.totalEmployers },
    { label: "Actifs", value: data.enabledEmployers },
    { label: "Vérifiés", value: data.verifiedEmployers },
    { label: "Jamais scrapés", value: data.neverScraped },
    { label: "Erreurs (25 derniers)", value: data.errorCount },
    { label: "Sources en échec", value: data.failingSources.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Source : {data.source === "api" ? "API locale" : data.source === "turso" ? "Turso (direct)" : "instantané statique"}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Actualiser
        </button>
      </div>
      {data.failingSources.length > 0 && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/40">
          <h2 className="font-bold text-red-900 dark:text-red-200">Santé des scrapers</h2>
          <p className="mt-1 text-xs text-red-800 dark:text-red-300">
            Dernier run en erreur. Au-delà de {FAILING_ALERT_DAYS} jours sans succès → à traiter en priorité.
          </p>
          <ul className="mt-2 space-y-1.5">
            {data.failingSources.map((s) => {
              const alert = (s.daysSinceSuccess ?? 0) >= FAILING_ALERT_DAYS;
              return (
                <li key={s.sourceId} className="flex flex-wrap items-baseline gap-x-2">
                  <span>{alert ? "⚠" : "❌"}</span>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-red-700 dark:text-red-300">
                    {s.daysSinceSuccess == null
                      ? "échec"
                      : `depuis ${s.daysSinceSuccess} j`}
                    {alert ? " · alerte" : ""}
                  </span>
                  {s.error && <span className="truncate text-xs text-red-600">{s.error}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section className="grid grid-cols-2 gap-2 md:grid-cols-7">
        {kpis.map((k) => (
          <article key={k.label} className="rounded-lg border border-slate-200 bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="text-xl font-bold text-slate-900 dark:text-white">{k.value}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{k.label}</div>
          </article>
        ))}
      </section>
      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-bold">Top sources (offres)</h2>
          {data.topSources.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Aucune offre en base.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {data.topSources.map((s) => (
                <li key={s.id} className="flex justify-between gap-2">
                  <span className="truncate">{s.name}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-bold">Activité récente</h2>
          {data.recentRuns.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Aucun scrape enregistré (connecte Turso ou l’API).</p>
          ) : (
            <ul className="mt-2 max-h-96 space-y-2 overflow-y-auto text-xs">
              {data.recentRuns.map((r) => {
                const d = r.diff;
                const hasDiff = !!(d && ((d.added?.length ?? 0) + (d.changed?.length ?? 0) + (d.removed?.length ?? 0) > 0));
                return (
                  <li key={r.id} className="border-b border-slate-100 pb-2 dark:border-slate-800">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span>{r.status === "error" ? "❌" : r.status === "running" ? "⏳" : "✅"}</span>
                      <span className="font-medium">{r.name}</span>
                      <span className="text-slate-400">{relTime(r.at)}</span>
                      {r.status === "error" ? (
                        <span className="truncate text-red-600">{r.error}</span>
                      ) : (
                        <span className="text-slate-500">
                          {r.found} trouvée(s)
                          {hasDiff
                            ? ` · +${d!.added?.length ?? 0} ~${d!.changed?.length ?? 0} -${d!.removed?.length ?? 0}`
                            : r.inserted
                              ? ` · +${r.inserted}`
                              : ""}
                        </span>
                      )}
                    </div>
                    {hasDiff && (
                      <ul className="mt-1 space-y-0.5 pl-5 text-slate-600 dark:text-slate-300">
                        {(d!.added ?? []).slice(0, 4).map((e, i) => (
                          <li key={`a${i}`} className="truncate text-green-700">+ {e.title}</li>
                        ))}
                        {(d!.changed ?? []).slice(0, 3).map((e, i) => (
                          <li key={`c${i}`} className="truncate text-amber-700">~ {e.title}</li>
                        ))}
                        {(d!.removed ?? []).slice(0, 4).map((e, i) => (
                          <li key={`r${i}`} className="truncate text-red-600">- {e.title}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      <ApplyClicksPanel />
    </div>
  );
}
