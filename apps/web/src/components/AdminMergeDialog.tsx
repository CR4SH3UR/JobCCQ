"use client";

import type { ReactNode } from "react";
import { hasCustomScraper, type MergeField, type MergePlan, type MergeSide } from "@jobccq/shared";

type Emp = {
  id: string;
  name: string;
  homepage: string;
  careersUrl: string;
  method: string;
  careersUrl2?: string | null;
  method2?: string | null;
  region?: string;
  rbq?: string;
  scope?: string;
  sectors?: readonly string[];
  verified?: boolean;
  enabled?: boolean;
  notes?: string;
};

const FIELD_LABEL: Record<MergeField, string> = {
  name: "Nom",
  homepage: "Site web",
  careersUrl: "Carrières + méthode",
  careersUrl2: "2e page carrières",
  region: "Région",
  rbq: "N° RBQ",
  scope: "Portée",
  sectors: "Secteurs",
  verified: "Vérifié",
  enabled: "Actif",
  notes: "Notes internes",
};

const BOTH_FIELDS = new Set<MergeField>(["careersUrl", "careersUrl2", "sectors", "notes", "verified"]);

function preview(e: Emp, field: MergeField): string {
  switch (field) {
    case "name":
      return e.name || "—";
    case "homepage":
      return e.homepage || "—";
    case "careersUrl":
      return e.careersUrl ? `${e.careersUrl} · ${e.method}` : "—";
    case "careersUrl2": {
      if (e.careersUrl2) return `${e.careersUrl2}${e.method2 ? ` · ${e.method2}` : ""}`;
      return e.careersUrl ? `${e.careersUrl} · ${e.method}` : "—";
    }
    case "region":
      return e.region || "—";
    case "rbq":
      return e.rbq || "—";
    case "scope":
      return e.scope || "—";
    case "sectors":
      return (e.sectors ?? []).filter(Boolean).join(", ") || "—";
    case "verified":
      return e.verified ? "oui" : "non";
    case "enabled":
      return e.enabled === false ? "non" : "oui";
    case "notes":
      return (e.notes ?? "").trim() || "—";
  }
}

function SideBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
        active ? "bg-amber-700 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

export function AdminMergeDialog({
  a,
  b,
  plan,
  jobs,
  localOnly,
  busy,
  onChange,
  onConfirm,
  onCancel,
}: {
  a: Emp;
  b: Emp;
  plan: MergePlan;
  jobs: { a: number; b: number };
  localOnly: boolean;
  busy?: boolean;
  onChange: (next: MergePlan) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const keep = plan.keepId === a.id ? a : b;
  const drop = plan.keepId === a.id ? b : a;
  const setKeep = (id: string) => onChange({ ...plan, keepId: id });
  const setField = (field: MergeField, side: MergeSide) =>
    onChange({ ...plan, fields: { ...plan.fields, [field]: side } });

  const card = (e: Emp, n: number, side: "a" | "b") => {
    const selected = plan.keepId === e.id;
    const custom = hasCustomScraper(e.id);
    return (
      <button
        type="button"
        onClick={() => setKeep(e.id)}
        className={`w-full rounded-lg border p-3 text-left ${
          selected ? "border-amber-500 bg-amber-50 ring-2 ring-amber-300" : "border-slate-200 bg-white hover:bg-slate-50"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{side === "a" ? "Fiche A" : "Fiche B"}</span>
          {selected && <span className="rounded bg-amber-700 px-1.5 py-0.5 text-[10px] font-bold text-white">ID conservé</span>}
        </div>
        <p className="mt-1 font-semibold text-slate-900">{e.name}</p>
        <p className="font-mono text-xs text-slate-600">{e.id}</p>
        <p className="mt-1 text-xs text-slate-500">
          {n} offre(s)
          {custom ? " · scraper sur mesure" : ""}
          {e.verified ? " · vérifié" : ""}
          {e.enabled === false ? " · inactif" : ""}
        </p>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 px-4 py-6">
      <button type="button" aria-label="Fermer la fusion" className="absolute inset-0 cursor-default" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-dialog-title"
        className="relative mt-2 w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 id="merge-dialog-title" className="text-sm font-semibold text-slate-900">
            Fusionner deux employeurs
          </h2>
          <button type="button" onClick={onCancel} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">
            Fermer ✕
          </button>
        </div>
        <div className="max-h-[80vh] space-y-4 overflow-y-auto p-4 text-sm">
          <p className="text-slate-600">
            Choisis <strong>qui reste</strong> (id conservé). L’autre fiche est absorbée : ses offres passent sous cet id,
            puis elle est supprimée.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {card(a, jobs.a, "a")}
            {card(b, jobs.b, "b")}
          </div>
          {hasCustomScraper(drop.id) && !hasCustomScraper(keep.id) && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Attention : l’id absorbé <code className="font-mono">{drop.id}</code> a un scraper sur mesure. En le
              laissant partir, ce parseur ne sera plus branché.
            </p>
          )}
          <p className="text-xs text-slate-500">
            Résultat : <strong>{keep.name}</strong> conserve l’id <code className="font-mono">{keep.id}</code>.{" "}
            <code className="font-mono">{drop.id}</code> disparaît.
          </p>

          <h3 className="font-semibold text-slate-800">Infos à garder</h3>
          <p className="text-xs text-slate-500">Pour chaque champ, prends A, B, ou les deux quand c’est utile.</p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Champ</th>
                  <th className="px-2 py-1.5 font-medium">A — {a.name}</th>
                  <th className="px-2 py-1.5 font-medium">B — {b.name}</th>
                  <th className="px-2 py-1.5 font-medium">Choix</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(FIELD_LABEL) as MergeField[]).map((field) => (
                  <tr key={field} className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap px-2 py-1.5 font-medium text-slate-700">{FIELD_LABEL[field]}</td>
                    <td className="max-w-[14rem] break-all px-2 py-1.5 text-slate-600">{preview(a, field)}</td>
                    <td className="max-w-[14rem] break-all px-2 py-1.5 text-slate-600">{preview(b, field)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      <div className="flex flex-wrap gap-1">
                        <SideBtn active={plan.fields[field] === "a"} onClick={() => setField(field, "a")}>
                          A
                        </SideBtn>
                        <SideBtn active={plan.fields[field] === "b"} onClick={() => setField(field, "b")}>
                          B
                        </SideBtn>
                        {BOTH_FIELDS.has(field) && (
                          <SideBtn active={plan.fields[field] === "both"} onClick={() => setField(field, "both")}>
                            les deux
                          </SideBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {localOnly && (
            <p className="text-xs text-amber-800">
              Mode local : fusion dans ce navigateur seulement (les offres en base ne bougent pas).
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Fusion…" : `Fusionner dans ${keep.id}`}
          </button>
        </div>
      </div>
    </div>
  );
}
