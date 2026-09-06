"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DISCOVERED_EMPLOYERS,
  JOB_CATEGORIES,
  QUEBEC_REGIONS,
  filterByEmployers,
  getEmployer,
  jobDetailHref,
  labelForClaimStatus,
  labelForEmployerJobStatus,
  type EmployerJobDraft,
} from "@jobccq/shared";
import { useAuth } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import {
  approvedEmployerIds,
  fetchMyClaims,
  submitClaim,
  type EmployerClaim,
} from "@/lib/employer-claims";
import { fetchEmployerOverrides, upsertEmployerOverride } from "@/lib/employer-overrides";
import { fetchMyEmployerJobs, submitEmployerJob, type EmployerJobRow } from "@/lib/employer-jobs";
import { fetchApplyClickStats } from "@/lib/apply-clicks";
import { fetchJobViewStats } from "@/lib/job-views";
import { invalidateJobsCache } from "@/lib/data";
import { Badge } from "./Badge";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

/** Tableau de bord + réclamation + publication (idées 87–89). */
export function EmployerSpaceView() {
  const { user, enabled, loading } = useAuth();
  const [claims, setClaims] = useState<EmployerClaim[]>([]);
  const [jobs, setJobs] = useState<EmployerJobRow[]>([]);
  const [views, setViews] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [byJob, setByJob] = useState<{ title: string; views: number; clicks: number }[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const approvedIds = useMemo(() => approvedEmployerIds(claims), [claims]);
  const activeId = approvedIds[0];
  const employer = activeId ? getEmployer(activeId) : undefined;

  const reload = useCallback(async () => {
    const uid = user?.id ?? "";
    const mine = await fetchMyClaims(uid);
    setClaims(mine);
    const ids = approvedEmployerIds(mine);
    const [mineJobs, clickPack, viewPack] = await Promise.all([
      fetchMyEmployerJobs(uid),
      fetchApplyClickStats(),
      fetchJobViewStats(),
    ]);
    setJobs(mineJobs);
    const clickF = filterByEmployers(clickPack.stats.byJob, ids);
    const viewF = filterByEmployers(viewPack.stats.byJob, ids);
    setClicks(clickF.reduce((n, r) => n + r.count, 0));
    setViews(viewF.reduce((n, r) => n + r.count, 0));
    const titles = new Map<string, { title: string; views: number; clicks: number }>();
    for (const r of viewF) titles.set(r.jobId, { title: r.title, views: r.count, clicks: 0 });
    for (const r of clickF) {
      const prev = titles.get(r.jobId) ?? { title: r.title, views: 0, clicks: 0 };
      prev.clicks = r.count;
      titles.set(r.jobId, prev);
    }
    setByJob([...titles.values()].sort((a, b) => b.views + b.clicks - (a.views + a.clicks)));
  }, [user?.id]);

  useEffect(() => {
    if (!loading) void reload();
  }, [loading, reload]);

  if (loading) return <p className="text-slate-500">Chargement…</p>;

  if (enabled && !user) {
    return (
      <div className="card max-w-md p-5">
        <p className="mb-3 text-sm text-slate-600">Connecte-toi pour réclamer une fiche et publier des offres.</p>
        <LoginForm />
      </div>
    );
  }

  const matches = q.trim().length < 2
    ? []
    : DISCOVERED_EMPLOYERS.filter((e) => e.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);

  return (
    <div className="space-y-8">
      {msg && <p className="text-sm text-slate-600">{msg}</p>}

      {!activeId && (
        <section className="card p-5">
          <h2 className="font-semibold">Réclamer une fiche</h2>
          <p className="mt-1 text-sm text-slate-600">
            Cherche ton entreprise. Un admin validera avant que tu puisses corriger la fiche ou publier.
          </p>
          <input
            className={`${inputCls} mt-3`}
            placeholder="Nom de l'entreprise…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <ul className="mt-2 divide-y divide-slate-100">
            {matches.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm">
                  {e.name}
                  {e.region ? <span className="text-slate-400"> · {e.region}</span> : null}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  onClick={async () => {
                    setBusy(true);
                    setMsg("");
                    try {
                      await submitClaim(e.id, user?.id ?? "", "", user?.email ?? "");
                      setMsg(`Demande envoyée pour ${e.name}.`);
                      await reload();
                    } catch (err) {
                      setMsg(err instanceof Error ? err.message : "Envoi impossible");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Réclamer
                </button>
              </li>
            ))}
          </ul>
          {claims.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm">
              {claims.map((c) => (
                <li key={`${c.userId}-${c.employerId}`}>
                  {getEmployer(c.employerId)?.name ?? c.employerId}{" "}
                  <Badge>{labelForClaimStatus(c.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeId && employer && (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Stat label="Vues de fiches" value={views} />
            <Stat label="Clics Postuler" value={clicks} />
            <Stat label="Offres publiées ici" value={jobs.filter((j) => j.status === "approved").length} />
          </section>

          {byJob.length > 0 && (
            <section className="card overflow-hidden">
              <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">Tes offres</h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {byJob.map((r) => (
                  <li key={r.title} className="flex justify-between gap-3 px-4 py-2">
                    <span className="truncate">{r.title}</span>
                    <span className="shrink-0 text-slate-500">
                      {r.views} vues · {r.clicks} clics
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <FicheEditor
            employerId={activeId}
            name={employer.name}
            onSaved={() => setMsg("Fiche mise à jour.")}
          />

          <JobPoster
            employer={{ id: employer.id, name: employer.name }}
            userId={user?.id ?? ""}
            onPosted={async () => {
              setMsg("Offre envoyée — en attente de modération.");
              invalidateJobsCache();
              await reload();
            }}
          />

          {jobs.length > 0 && (
            <section className="card p-5">
              <h2 className="font-semibold">Tes publications</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {jobs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <Link href={jobDetailHref(r.job.id)} className="font-medium text-brand-700 hover:underline">
                      {r.job.title}
                    </Link>
                    <Badge>{labelForEmployerJobStatus(r.status)}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function FicheEditor({
  employerId,
  name,
  onSaved,
}: {
  employerId: string;
  name: string;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchEmployerOverrides().then((m) => {
      const p = m.get(employerId);
      setDescription(p?.description ?? "");
      setLogoUrl(p?.logoUrl ?? "");
    });
  }, [employerId]);

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Fiche {name}</h2>
      <p className="mt-1 text-sm text-slate-600">Logo (URL) et texte affichés sur ta page publique.</p>
      <label className="mt-3 block text-xs font-medium text-slate-600">Logo (https://…)</label>
      <input className={inputCls} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} spellCheck={false} />
      <label className="mt-3 block text-xs font-medium text-slate-600">Description</label>
      <textarea
        className={`${inputCls} min-h-28`}
        value={description}
        maxLength={2000}
        onChange={(e) => setDescription(e.target.value)}
      />
      <button
        type="button"
        disabled={busy}
        className="mt-3 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
        onClick={async () => {
          setBusy(true);
          try {
            await upsertEmployerOverride(employerId, { description, logoUrl });
            onSaved();
          } finally {
            setBusy(false);
          }
        }}
      >
        Enregistrer la fiche
      </button>
    </section>
  );
}

function JobPoster({
  employer,
  userId,
  onPosted,
}: {
  employer: { id: string; name: string };
  userId: string;
  onPosted: () => void;
}) {
  const [draft, setDraft] = useState<EmployerJobDraft>({ title: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof EmployerJobDraft, v: string) => setDraft((d) => ({ ...d, [k]: v || undefined }));

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Publier une offre</h2>
      <p className="mt-1 text-sm text-slate-600">Elle apparaît sur le site après validation.</p>
      <label className="mt-3 block text-xs font-medium text-slate-600">Titre</label>
      <input className={inputCls} value={draft.title} onChange={(e) => set("title", e.target.value)} />
      <label className="mt-3 block text-xs font-medium text-slate-600">Lien pour postuler (optionnel)</label>
      <input className={inputCls} value={draft.url ?? ""} onChange={(e) => set("url", e.target.value)} />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-600">Ville</label>
          <input className={inputCls} value={draft.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Région</label>
          <select className={inputCls} value={draft.regionId ?? ""} onChange={(e) => set("regionId", e.target.value)}>
            <option value="">—</option>
            {QUEBEC_REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Domaine</label>
          <select className={inputCls} value={draft.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value)}>
            <option value="">—</option>
            {JOB_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Salaire min ($)</label>
          <input
            className={inputCls}
            type="number"
            value={draft.salaryMin ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, salaryMin: e.target.value ? Number(e.target.value) : undefined }))
            }
          />
        </div>
      </div>
      <label className="mt-3 block text-xs font-medium text-slate-600">Description</label>
      <textarea
        className={`${inputCls} min-h-24`}
        value={draft.description ?? ""}
        onChange={(e) => set("description", e.target.value)}
      />
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <button
        type="button"
        disabled={busy}
        className="mt-3 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        onClick={async () => {
          setBusy(true);
          setErr("");
          try {
            await submitEmployerJob(draft, employer, userId);
            setDraft({ title: "" });
            onPosted();
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Publication impossible");
          } finally {
            setBusy(false);
          }
        }}
      >
        Envoyer pour modération
      </button>
    </section>
  );
}
