"use client";

import { useEffect, useMemo, useState } from "react";
import { DISCOVERED_EMPLOYERS } from "@jobccq/shared";
import { SPONSOR_CONFIG, type Sponsor, type SponsorConfig } from "@/lib/sponsors";

/**
 * Éditeur des commandites (console d'administration).
 *
 * Édite `apps/web/src/data/sponsors.json` : commanditaires de la bannière,
 * employeurs en vedette, courriel de contact. « Publier » écrit le fichier sur
 * GitHub (même mécanisme que la publication des employeurs) → redéploiement.
 * Réutilise le jeton GitHub déjà saisi dans le panneau principal (localStorage).
 */
const LS_TOKEN = "admin:ghtoken";
const PATH = "apps/web/src/data/sponsors.json";

function ghRepo(): { owner: string; repo: string } {
  try {
    const host = location.hostname.split(".")[0];
    const seg = location.pathname.split("/").filter(Boolean)[0];
    if (location.hostname.endsWith("github.io") && host && seg) return { owner: host, repo: seg };
  } catch {
    /* SSR */
  }
  return { owner: "CR4SH3UR", repo: "JobCCQ" };
}

const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

function b64utf8(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

function readToken(): string {
  try {
    return localStorage.getItem(LS_TOKEN) ?? "";
  } catch {
    return "";
  }
}

export function AdminSponsors() {
  const [cfg, setCfg] = useState<SponsorConfig>(SPONSOR_CONFIG);
  const [featInput, setFeatInput] = useState("");
  const [status, setStatus] = useState<{ k: "idle" | "run" | "ok" | "err"; msg?: string }>({ k: "idle" });

  // Charge la version la plus récente committée (évite de repartir d'un bundle périmé).
  useEffect(() => {
    const { owner, repo } = ghRepo();
    (async () => {
      try {
        const r = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/main/${PATH}?t=${Date.now()}`,
          { cache: "no-store" },
        );
        if (r.ok) {
          const d = (await r.json()) as SponsorConfig;
          setCfg({ contactEmail: d.contactEmail ?? "", sponsors: d.sponsors ?? [], featured: d.featured ?? [] });
        }
      } catch {
        /* garde le bundle */
      }
    })();
  }, []);

  const empName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of DISCOVERED_EMPLOYERS) m[e.id] = e.name;
    return m;
  }, []);

  const setSponsors = (sponsors: Sponsor[]) => setCfg((c) => ({ ...c, sponsors }));
  const updateSponsor = (i: number, patch: Partial<Sponsor>) =>
    setSponsors(cfg.sponsors.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addSponsor = () =>
    setSponsors([...cfg.sponsors, { id: `sponsor-${cfg.sponsors.length + 1}`, name: "", tagline: "", url: "" }]);
  const removeSponsor = (i: number) => setSponsors(cfg.sponsors.filter((_, idx) => idx !== i));

  const addFeatured = (raw: string) => {
    const id = raw.trim();
    if (!id || cfg.featured.includes(id)) return;
    setCfg((c) => ({ ...c, featured: [...c.featured, id] }));
    setFeatInput("");
  };
  const removeFeatured = (id: string) =>
    setCfg((c) => ({ ...c, featured: c.featured.filter((x) => x !== id) }));

  const publish = async () => {
    const token = readToken();
    if (!token) {
      setStatus({ k: "err", msg: "Connecte d'abord GitHub (panneau « Connecter GitHub » plus haut)." });
      return;
    }
    const { owner, repo } = ghRepo();
    const base = `https://api.github.com/repos/${owner}/${repo}/contents/${PATH}`;
    setStatus({ k: "run" });
    try {
      const clean: SponsorConfig = {
        contactEmail: cfg.contactEmail.trim(),
        sponsors: cfg.sponsors
          .filter((s) => s.name.trim() && s.url.trim())
          .map((s) => ({
            id: s.id,
            name: s.name.trim(),
            tagline: s.tagline.trim(),
            url: s.url.trim(),
            ...(s.logoUrl?.trim() ? { logoUrl: s.logoUrl.trim() } : {}),
          })),
        featured: [...new Set(cfg.featured.map((f) => f.trim()).filter(Boolean))],
      };
      const cur = await fetch(`${base}?ref=main`, { headers: GH_HEADERS(token) });
      const sha = cur.ok ? (await cur.json()).sha : undefined;
      const body = {
        message: "Admin : mise à jour des sponsors",
        content: b64utf8(JSON.stringify(clean, null, 2) + "\n"),
        branch: "main",
        ...(sha ? { sha } : {}),
      };
      const r = await fetch(base, { method: "PUT", headers: GH_HEADERS(token), body: JSON.stringify(body) });
      if (r.ok) {
        setStatus({ k: "ok", msg: "✅ Publié — le site va se redéployer (quelques minutes)." });
      } else {
        const d = await r.json().catch(() => ({}));
        setStatus({ k: "err", msg: (d as { message?: string }).message ?? `HTTP ${r.status}` });
      }
    } catch (e) {
      setStatus({ k: "err", msg: (e as Error).message });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10">
      <details className="card p-4">
        <summary className="cursor-pointer text-lg font-bold tracking-tight">
          💰 Sponsors &amp; employeurs en vedette
        </summary>

        <div className="mt-4 space-y-6 text-sm">
          {/* Courriel de contact */}
          <div>
            <label className="mb-1 block font-semibold text-slate-700">Courriel de contact (encart « Devenez commanditaire »)</label>
            <input
              type="email"
              value={cfg.contactEmail}
              onChange={(e) => setCfg((c) => ({ ...c, contactEmail: e.target.value }))}
              placeholder="ventes@exemple.com"
              className="w-full max-w-md rounded border border-slate-300 px-2 py-1"
            />
          </div>

          {/* Commanditaires (bannière) */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">Commanditaires (bannière)</h3>
              <button onClick={addSponsor} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold hover:bg-slate-100">
                + Ajouter
              </button>
            </div>
            {cfg.sponsors.length === 0 && (
              <p className="text-slate-500">Aucun commanditaire — la bannière affiche « Votre entreprise ici ».</p>
            )}
            <div className="space-y-3">
              {cfg.sponsors.map((s, i) => (
                <div key={s.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={s.name}
                      onChange={(e) => updateSponsor(i, { name: e.target.value })}
                      placeholder="Nom de l'annonceur"
                      className="rounded border border-slate-300 px-2 py-1"
                    />
                    <input
                      value={s.url}
                      onChange={(e) => updateSponsor(i, { url: e.target.value })}
                      placeholder="https://site-de-l-annonceur.com"
                      className="rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                    />
                    <input
                      value={s.tagline}
                      onChange={(e) => updateSponsor(i, { tagline: e.target.value })}
                      placeholder="Accroche (une phrase)"
                      className="rounded border border-slate-300 px-2 py-1 sm:col-span-2"
                    />
                    <input
                      value={s.logoUrl ?? ""}
                      onChange={(e) => updateSponsor(i, { logoUrl: e.target.value })}
                      placeholder="URL du logo (optionnel)"
                      className="rounded border border-slate-300 px-2 py-1 font-mono text-xs sm:col-span-2"
                    />
                  </div>
                  <div className="mt-2 text-right">
                    <button onClick={() => removeSponsor(i)} className="text-xs font-medium text-red-600 hover:underline">
                      Retirer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Employeurs en vedette */}
          <div>
            <h3 className="mb-2 font-semibold text-slate-700">Employeurs en vedette (offres épinglées + badge)</h3>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {cfg.featured.length === 0 && <span className="text-slate-500">Aucun employeur en vedette.</span>}
              {cfg.featured.map((id) => (
                <span key={id} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                  {empName[id] ?? id}
                  <button onClick={() => removeFeatured(id)} aria-label="Retirer" className="text-amber-600 hover:text-amber-900">
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                list="employer-suggestions"
                value={featInput}
                onChange={(e) => setFeatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addFeatured(resolveEmployerId(featInput, empName));
                  }
                }}
                placeholder="Chercher un employeur (nom) ou coller un id…"
                className="min-w-[16rem] flex-1 rounded border border-slate-300 px-2 py-1"
              />
              <datalist id="employer-suggestions">
                {DISCOVERED_EMPLOYERS.map((e) => (
                  <option key={e.id} value={e.name}>
                    {e.id}
                  </option>
                ))}
              </datalist>
              <button
                onClick={() => addFeatured(resolveEmployerId(featInput, empName))}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold hover:bg-slate-100"
              >
                + Mettre en vedette
              </button>
            </div>
          </div>

          {/* Publier */}
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
            <button
              onClick={publish}
              disabled={status.k === "run"}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {status.k === "run" ? "Publication…" : "⬆ Publier les sponsors"}
            </button>
            {status.msg && (
              <span className={status.k === "err" ? "text-red-600" : "text-green-700"}>{status.msg}</span>
            )}
            <span className="text-xs text-slate-400">Publie sur GitHub → redéploiement automatique du site.</span>
          </div>
        </div>
      </details>
    </div>
  );
}

/** Un nom saisi (via datalist) → id d'employeur ; sinon renvoie la saisie telle quelle (id collé). */
function resolveEmployerId(input: string, empName: Record<string, string>): string {
  const v = input.trim();
  if (!v) return "";
  for (const [id, name] of Object.entries(empName)) if (name === v || id === v) return id;
  return v;
}
