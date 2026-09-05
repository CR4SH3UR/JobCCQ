"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL, adminFetch, searchJobs, buildQuery } from "@/lib/data";
import type { Job } from "@jobccq/shared";
import { ensureTursoAdminColumns, tursoCreds, tursoExec, tursoRows } from "@/lib/admin-turso";
import { AdminOfferEditor, type OfferPatch, type OfferRow, type SaveState } from "./AdminOfferEditor";
import { logAudit } from "@/lib/admin-audit";

function whenMs(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v > 1e12 ? v : v * 1000;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : t;
}

function jobToRow(j: Job): OfferRow {
  return {
    id: j.id,
    title: j.title,
    company: j.company,
    url: j.url,
    location: j.location,
    city: j.city,
    regionId: j.regionId,
    remote: j.remote,
    categoryId: j.categoryId,
    employmentType: j.employmentType,
    salaryMin: j.salaryMin,
    salaryMax: j.salaryMax,
    salaryPeriod: j.salaryPeriod,
    currency: j.currency,
    description: j.description,
    tags: j.tags ?? [],
    languages: [...(j.languages ?? [])],
    postedAt: whenMs(j.postedAt ?? null),
    companyLogoUrl: j.companyLogoUrl,
  };
}

function tursoToRow(r: Record<string, unknown>): OfferRow & { sourceId: string } {
  const parseArr = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === "string") {
      try {
        const p = JSON.parse(v);
        return Array.isArray(p) ? p.map(String) : [];
      } catch {
        return [];
      }
    }
    return [];
  };
  const str = (v: unknown) => (v == null || String(v).trim() === "" ? undefined : String(v));
  const num = (v: unknown) => {
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    id: String(r.id ?? ""),
    sourceId: String(r.sourceId ?? ""),
    title: String(r.title ?? ""),
    company: String(r.company ?? ""),
    url: String(r.url ?? ""),
    location: str(r.location),
    city: str(r.city),
    regionId: str(r.regionId),
    remote: str(r.remote),
    categoryId: str(r.categoryId),
    employmentType: str(r.employmentType),
    salaryMin: num(r.salaryMin),
    salaryMax: num(r.salaryMax),
    salaryPeriod: str(r.salaryPeriod),
    currency: str(r.currency),
    description: str(r.description),
    tags: parseArr(r.tags),
    languages: parseArr(r.languages),
    postedAt: whenMs(r.postedAt),
    companyLogoUrl: str(r.companyLogoUrl),
  };
}

export function AdminJobs() {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<(OfferRow & { sourceId?: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [mode, setMode] = useState<"api" | "turso" | "static">("static");
  const [openId, setOpenId] = useState<string | null>(null);
  const [saves, setSaves] = useState<Record<string, SaveState>>({});
  const [msg, setMsg] = useState("");
  const pageSize = 40;

  const load = useCallback(async (query: string, p: number) => {
    setLoading(true);
    setError(undefined);
    try {
      try {
        const r = await adminFetch(
          `${API_URL}/admin/jobs?q=${encodeURIComponent(query)}&page=${p}&pageSize=${pageSize}`,
        );
        if (r.ok) {
          const d = (await r.json()) as { total: number; jobs: Job[] };
          setMode("api");
          setTotal(d.total);
          setRows(d.jobs.map(jobToRow));
          return;
        }
      } catch {
        /* repli Turso / snapshot */
      }
      const creds = tursoCreds();
      if (creds) {
        await ensureTursoAdminColumns(creds.url, creds.token);
        const like = `%${query.replaceAll("%", "")}%`;
        const where = query
          ? "WHERE title LIKE ? OR company LIKE ? OR url LIKE ? OR city LIKE ?"
          : "";
        const args = query ? [like, like, like, like] : [];
        const countRows = await tursoRows(creds.url, creds.token, `SELECT COUNT(*) AS n FROM Job ${where}`, args);
        const raw = await tursoRows(
          creds.url,
          creds.token,
          `SELECT id, sourceId, title, company, url, location, city, regionId, remote, categoryId, employmentType,
                salaryMin, salaryMax, salaryPeriod, currency, description, tags, languages, postedAt, companyLogoUrl
         FROM Job ${where} ORDER BY scrapedAt DESC LIMIT ? OFFSET ?`,
          [...args, pageSize, (p - 1) * pageSize],
        );
        setMode("turso");
        setTotal(Number(countRows[0]?.n ?? 0));
        setRows(raw.map(tursoToRow));
        return;
      }
      const res = await searchJobs(buildQuery({ q: query, page: p, pageSize, sort: "recent" }));
      setMode("static");
      setTotal(res.total);
      setRows(res.items.map(jobToRow));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setQ(qInput);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    void load(q, page);
  }, [load, q, page]);

  const persistPatch = async (id: string, patch: OfferPatch) => {
    setSaves((s) => ({ ...s, [id]: { s: "saving" } }));
    try {
      if (mode === "api") {
        const res = await adminFetch(`${API_URL}/admin/jobs/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else if (mode === "turso") {
        const creds = tursoCreds();
        if (!creds) throw new Error("Turso non configuré");
        const cols: string[] = [];
        const args: unknown[] = [];
        const strFields: (keyof OfferPatch)[] = [
          "title", "company", "url", "location", "city", "regionId", "remote",
          "categoryId", "employmentType", "salaryPeriod", "currency", "description", "companyLogoUrl",
        ];
        for (const k of strFields) {
          if (k in patch) {
            cols.push(`${k}=?`);
            args.push((patch as Record<string, unknown>)[k] ?? null);
          }
        }
        if ("salaryMin" in patch) {
          cols.push("salaryMin=?");
          args.push(patch.salaryMin ?? null);
        }
        if ("salaryMax" in patch) {
          cols.push("salaryMax=?");
          args.push(patch.salaryMax ?? null);
        }
        if ("tags" in patch) {
          cols.push("tags=?");
          args.push(JSON.stringify(patch.tags ?? []));
        }
        if ("languages" in patch) {
          cols.push("languages=?");
          args.push(JSON.stringify(patch.languages ?? []));
        }
        if ("postedAt" in patch) {
          cols.push("postedAt=?");
          args.push(patch.postedAt ? new Date(patch.postedAt).toISOString() : null);
        }
        if (!cols.length) return;
        cols.push("updatedAt=?");
        args.push(new Date().toISOString());
        args.push(id);
        await tursoExec(creds.url, creds.token, `UPDATE Job SET ${cols.join(",")} WHERE id=?`, args);
      } else {
        throw new Error("Édition indisponible en mode statique (sans API/Turso).");
      }
      setRows((list) => list.map((o) => (o.id === id ? { ...o, ...patch } : o)));
      setSaves((s) => ({ ...s, [id]: { s: "ok" } }));
      logAudit("edit", { targetId: id, targetName: patch.title ?? id, detail: "offre" });
    } catch (e) {
      setSaves((s) => ({ ...s, [id]: { s: "err", msg: (e as Error).message } }));
    }
  };

  const remove = async (row: OfferRow) => {
    if (!window.confirm(`Supprimer l'offre « ${row.title} » ?`)) return;
    try {
      if (mode === "api") {
        const res = await adminFetch(`${API_URL}/admin/jobs/${row.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else if (mode === "turso") {
        const creds = tursoCreds();
        if (!creds) throw new Error("Turso non configuré");
        await tursoExec(creds.url, creds.token, "DELETE FROM Job WHERE id=?", [row.id]);
      } else {
        throw new Error("Suppression indisponible en mode statique.");
      }
      setRows((list) => list.filter((o) => o.id !== row.id));
      setTotal((n) => Math.max(0, n - 1));
      setMsg("Offre supprimée.");
      logAudit("purge", { targetId: row.id, targetName: row.title, detail: "1 offre" });
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const lines = [["id", "titre", "entreprise", "ville", "url"].join(",")];
    for (const o of rows) lines.push([o.id, o.title, o.company, o.city ?? "", o.url].map(esc).join(","));
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "offres.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Rechercher titre, entreprise, URL, ville…"
          className="min-w-[16rem] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700"
        >
          Export CSV (page)
        </button>
      </div>
      <p className="text-xs text-slate-500">
        {loading ? "Chargement…" : `${total} offre(s)`} · mode {mode}
        {msg ? ` · ${msg}` : ""}
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="space-y-2">
        {rows.map((o) => (
          <li key={o.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-start gap-2">
              <button type="button" className="flex-1 text-left" onClick={() => setOpenId(openId === o.id ? null : o.id)}>
                <span className="font-semibold">{o.title}</span>
                <span className="ml-2 text-slate-500">{o.company}{o.city ? ` · ${o.city}` : ""}</span>
              </button>
              <a href={o.url} target="_blank" rel="noreferrer" className="text-xs text-brand-700 hover:underline">
                Source
              </a>
              {(mode === "api" || mode === "turso") && (
                <button
                  type="button"
                  onClick={() => void remove(o)}
                  className="text-xs font-semibold text-red-600 hover:underline"
                >
                  Supprimer
                </button>
              )}
            </div>
            {openId === o.id && (
              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <AdminOfferEditor
                  offer={o}
                  persistEnabled={mode === "api" || mode === "turso"}
                  save={saves[o.id]}
                  onSave={persistPatch}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <div className="flex items-center gap-2 text-xs">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">
            Précédent
          </button>
          <span>
            Page {page}/{pages}
          </span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40">
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
