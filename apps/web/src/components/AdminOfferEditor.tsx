"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  EMPLOYMENT_TYPES,
  JOB_CATEGORIES,
  labelForRegion,
  LANGUAGES,
  QUEBEC_REGIONS,
  REMOTE_TYPES,
  SALARY_PERIODS,
} from "@jobccq/shared";
import { resolveRegionForCity } from "@/lib/municipalities";
import { siteUrl } from "@/lib/site";
import { Badge } from "./Badge";

/** Offre affichée / éditée dans le panneau employeur. */
export type OfferRow = {
  id: string;
  title: string;
  company: string;
  url: string;
  location?: string;
  city?: string;
  regionId?: string;
  remote?: string;
  categoryId?: string;
  employmentType?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryPeriod?: string;
  currency?: string;
  description?: string;
  tags: string[];
  languages: string[];
  postedAt: number | null;
  companyLogoUrl?: string;
};

export type OfferPatch = Partial<Omit<OfferRow, "id">>;

export type SaveState = { s: "saving" | "ok" | "local" | "err"; msg?: string };

function toLocalInput(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function field(label: string, children: ReactNode) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "rounded border border-slate-300 px-2 py-1 bg-white";

export function AdminOfferEditor({
  offer,
  persistEnabled,
  save,
  onSave,
}: {
  offer: OfferRow;
  persistEnabled: boolean;
  save?: SaveState;
  onSave: (id: string, patch: OfferPatch) => void;
}) {
  const [title, setTitle] = useState(offer.title);
  const [company, setCompany] = useState(offer.company);
  const [url, setUrl] = useState(offer.url);
  const [location, setLocation] = useState(offer.location ?? "");
  const [city, setCity] = useState(offer.city ?? "");
  const [regionId, setRegionId] = useState(offer.regionId ?? "");
  const [remote, setRemote] = useState(offer.remote ?? "");
  const [categoryId, setCategoryId] = useState(offer.categoryId ?? "");
  const [employmentType, setEmploymentType] = useState(offer.employmentType ?? "");
  const [salaryMin, setSalaryMin] = useState(offer.salaryMin != null ? String(offer.salaryMin) : "");
  const [salaryMax, setSalaryMax] = useState(offer.salaryMax != null ? String(offer.salaryMax) : "");
  const [salaryPeriod, setSalaryPeriod] = useState(offer.salaryPeriod ?? "");
  const [currency, setCurrency] = useState(offer.currency ?? "CAD");
  const [description, setDescription] = useState(offer.description ?? "");
  const [tags, setTags] = useState(offer.tags.join(", "));
  const [languages, setLanguages] = useState<string[]>([...offer.languages]);
  const [postedAt, setPostedAt] = useState(toLocalInput(offer.postedAt));
  const [companyLogoUrl, setCompanyLogoUrl] = useState(offer.companyLogoUrl ?? "");
  // Retour du bouton « déduire la région de la ville ».
  const [regionHint, setRegionHint] = useState<{ tone: "ok" | "err"; msg: string } | null>(null);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    setTitle(offer.title);
    setCompany(offer.company);
    setUrl(offer.url);
    setLocation(offer.location ?? "");
    setCity(offer.city ?? "");
    setRegionId(offer.regionId ?? "");
    setRemote(offer.remote ?? "");
    setCategoryId(offer.categoryId ?? "");
    setEmploymentType(offer.employmentType ?? "");
    setSalaryMin(offer.salaryMin != null ? String(offer.salaryMin) : "");
    setSalaryMax(offer.salaryMax != null ? String(offer.salaryMax) : "");
    setSalaryPeriod(offer.salaryPeriod ?? "");
    setCurrency(offer.currency ?? "CAD");
    setDescription(offer.description ?? "");
    setTags(offer.tags.join(", "));
    setLanguages([...offer.languages]);
    setPostedAt(toLocalInput(offer.postedAt));
    setCompanyLogoUrl(offer.companyLogoUrl ?? "");
    setRegionHint(null);
  }, [offer]);

  const toggleLang = (id: string) =>
    setLanguages((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  /** Déduit la région à partir de la ville saisie (table des municipalités). */
  const detectRegion = async () => {
    const c = city.trim();
    if (!c) {
      setRegionHint({ tone: "err", msg: "Saisis d'abord une ville." });
      return;
    }
    setDetecting(true);
    setRegionHint(null);
    try {
      const rid = await resolveRegionForCity(c);
      if (rid) {
        setRegionId(rid);
        setRegionHint({ tone: "ok", msg: `Région trouvée : ${labelForRegion(rid) ?? rid}` });
      } else {
        setRegionHint({ tone: "err", msg: `« ${c} » introuvable dans la table des municipalités.` });
      }
    } catch (e) {
      setRegionHint({ tone: "err", msg: (e as Error).message });
    } finally {
      setDetecting(false);
    }
  };

  const submit = () => {
    const num = (s: string) => {
      const t = s.trim();
      if (!t) return undefined;
      const n = Number(t);
      return Number.isFinite(n) ? n : undefined;
    };
    onSave(offer.id, {
      title: title.trim(),
      company: company.trim(),
      url: url.trim(),
      location: location.trim() || undefined,
      city: city.trim() || undefined,
      regionId: regionId || undefined,
      remote: remote || undefined,
      categoryId: categoryId || undefined,
      employmentType: employmentType || undefined,
      salaryMin: num(salaryMin),
      salaryMax: num(salaryMax),
      salaryPeriod: salaryPeriod || undefined,
      currency: currency.trim() || undefined,
      description: description.trim() || undefined,
      tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
      languages,
      postedAt: postedAt ? new Date(postedAt).getTime() : null,
      companyLogoUrl: companyLogoUrl.trim() || undefined,
    });
  };

  return (
    <div className="mt-1 rounded-md border border-brand-200 bg-white p-2">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        <span>id :</span>
        <code className="rounded bg-slate-50 px-1.5 py-0.5 font-mono text-slate-700 ring-1 ring-slate-200">{offer.id}</code>
        {!persistEnabled && (
          <span className="text-amber-700">Connecte Turso ou l’API pour enregistrer en base.</span>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {field("Titre", <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />)}
        {field("Entreprise", <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} />)}
        {field(
          "URL",
          <input value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} className={`${inputCls} font-mono`} />,
        )}
        {field("Logo (URL)", <input value={companyLogoUrl} onChange={(e) => setCompanyLogoUrl(e.target.value)} spellCheck={false} className={`${inputCls} font-mono`} />)}
        {field("Lieu (brut)", <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} />)}
        {field("Ville", <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />)}
        <div className="flex flex-col gap-0.5">
          <span className="text-slate-500">Région</span>
          <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className={inputCls}>
            <option value="">— Aucune —</option>
            {QUEBEC_REGIONS.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={detectRegion}
            disabled={detecting}
            title="Déduit la région à partir de la ville (table des municipalités)"
            className="mt-0.5 self-start rounded border border-brand-300 px-2 py-0.5 text-[11px] font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-40"
          >
            {detecting ? "Recherche…" : "🔎 Déduire de la ville"}
          </button>
          {regionHint && (
            <span className={regionHint.tone === "ok" ? "text-[11px] text-green-700" : "text-[11px] text-amber-700"}>
              {regionHint.msg}
            </span>
          )}
        </div>
        {field(
          "Présentiel / remote",
          <select value={remote} onChange={(e) => setRemote(e.target.value)} className={inputCls}>
            <option value="">— Aucun —</option>
            {REMOTE_TYPES.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>,
        )}
        {field(
          "Catégorie",
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
            <option value="">— Aucune —</option>
            {JOB_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>,
        )}
        {field(
          "Type de poste",
          <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className={inputCls}>
            <option value="">— Aucun —</option>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>,
        )}
        {field("Salaire min", <input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} className={inputCls} />)}
        {field("Salaire max", <input type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} className={inputCls} />)}
        {field(
          "Période",
          <select value={salaryPeriod} onChange={(e) => setSalaryPeriod(e.target.value)} className={inputCls}>
            <option value="">— Aucune —</option>
            {SALARY_PERIODS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>,
        )}
        {field("Devise", <input value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls} />)}
        {field("Publiée le", <input type="datetime-local" value={postedAt} onChange={(e) => setPostedAt(e.target.value)} className={inputCls} />)}
        {field("Tags (virgules)", <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputCls} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        <span className="text-slate-500">Langues</span>
        {LANGUAGES.map((l) => (
          <label key={l.id} className="flex items-center gap-1">
            <input type="checkbox" checked={languages.includes(l.id)} onChange={() => toggleLang(l.id)} className="accent-brand-600" />
            {l.label}
          </label>
        ))}
      </div>
      {field(
        "Description",
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} className={`${inputCls} mt-0.5 w-full`} />,
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!persistEnabled || save?.s === "saving" || !title.trim() || !company.trim() || !url.trim()}
          onClick={submit}
          className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-30"
        >
          Enregistrer l’offre
        </button>
        {save?.s === "saving" && <span className="text-slate-500">Enregistrement…</span>}
        {save?.s === "ok" && <Badge tone="green">Enregistré</Badge>}
        {save?.s === "err" && <span className="text-red-600">Échec{save.msg ? ` — ${save.msg}` : ""}</span>}
        <a
          href={siteUrl(`/emplois/${offer.id}/`)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-brand-700 hover:underline"
        >
          Voir sur le site ↗
        </a>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
          Voir la source ↗
        </a>
      </div>
    </div>
  );
}
