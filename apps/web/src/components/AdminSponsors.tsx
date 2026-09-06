"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DISCOVERED_EMPLOYERS } from "@jobccq/shared";
import {
  SPONSOR_CONFIG,
  mergeSponsorPublish,
  parseSponsorTier,
  readConfig,
  type PinnedJob,
  type Sponsor,
  type SponsorConfig,
} from "@/lib/sponsors";
import { setLiveSponsorConfig, sponsorsRawUrl } from "@/lib/sponsors-live";

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

function utf8fromB64(b64: string): string {
  return decodeURIComponent(escape(atob(b64.replace(/\s/g, ""))));
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
  const [pinId, setPinId] = useState("");
  const [pinUntil, setPinUntil] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [status, setStatus] = useState<{ k: "idle" | "run" | "ok" | "err"; msg?: string }>({ k: "idle" });

  const edit = (fn: (c: SponsorConfig) => SponsorConfig) => {
    dirtyRef.current = true;
    setDirty(true);
    setCfg(fn);
  };

  // Charge GitHub `main` une fois. N'écrase pas une saisie déjà commencée.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = readToken();
        const { owner, repo } = ghRepo();
        let parsed: SponsorConfig | null = null;
        if (token) {
          const r = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${PATH}?ref=main`,
            { headers: GH_HEADERS(token), cache: "no-store" },
          );
          if (r.ok) {
            const d = (await r.json()) as { content?: string };
            if (d.content) parsed = readConfig(JSON.parse(utf8fromB64(d.content)));
          }
        }
        if (!parsed) {
          const r = await fetch(sponsorsRawUrl(), { cache: "no-store" });
          if (r.ok) parsed = readConfig(await r.json());
        }
        if (!alive || !parsed) return;
        setCfg((c) => (dirtyRef.current ? c : parsed));
        if (!dirtyRef.current) setLiveSponsorConfig(parsed);
        setLoaded(true);
      } catch {
        /* garde le bundle */
      }
    })();
    return () => {
      alive = false;
    };
    // `dirty` lu au retour du fetch, pas en dépendance (on ne relance pas).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of DISCOVERED_EMPLOYERS) m[e.id] = e.name;
    return m;
  }, []);

  const setSponsors = (sponsors: Sponsor[]) => edit((c) => ({ ...c, sponsors }));
  const updateSponsor = (i: number, patch: Partial<Sponsor>) =>
    edit((c) => ({
      ...c,
      sponsors: c.sponsors.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    }));
  const addSponsor = () =>
    edit((c) => ({
      ...c,
      sponsors: [
        ...c.sponsors,
        { id: `sponsor-${c.sponsors.length + 1}`, name: "", tagline: "", url: "", tier: "argent" },
      ],
    }));
  const removeSponsor = (i: number) => edit((c) => ({ ...c, sponsors: c.sponsors.filter((_, idx) => idx !== i) }));

  const addPinned = () => {
    const jobId = pinId.trim();
    if (!jobId || cfg.pinned.some((p) => p.jobId === jobId)) return;
    const until = pinUntil.trim().slice(0, 10);
    const next: PinnedJob = until ? { jobId, until } : { jobId };
    edit((c) => ({ ...c, pinned: [...c.pinned, next] }));
    setPinId("");
  };
  const removePinned = (jobId: string) =>
    edit((c) => ({ ...c, pinned: c.pinned.filter((p) => p.jobId !== jobId) }));
  const patchPinned = (jobId: string, until: string) =>
    edit((c) => ({
      ...c,
      pinned: c.pinned.map((p) =>
        p.jobId === jobId ? { jobId, ...(until.trim() ? { until: until.trim().slice(0, 10) } : {}) } : p,
      ),
    }));

  const addFeatured = (raw: string) => {
    const id = raw.trim();
    if (!id) return;
    edit((c) => (c.featured.includes(id) ? c : { ...c, featured: [...c.featured, id] }));
    setFeatInput("");
  };
  const removeFeatured = (id: string) =>
    edit((c) => ({ ...c, featured: c.featured.filter((x) => x !== id) }));

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
      const local: SponsorConfig = {
        contactEmail: cfg.contactEmail.trim(),
        sponsors: cfg.sponsors
          .filter((s) => s.name.trim() && s.url.trim())
          .map((s) => ({
            id: s.id,
            name: s.name.trim(),
            tagline: s.tagline.trim(),
            url: s.url.trim(),
            tier: parseSponsorTier(s.tier),
            ...(s.logoUrl?.trim() ? { logoUrl: s.logoUrl.trim() } : {}),
          })),
        featured: [...new Set(cfg.featured.map((f) => f.trim()).filter(Boolean))],
        pinned: cfg.pinned
          .map((p) => {
            const jobId = p.jobId.trim();
            const until = (p.until ?? "").trim().slice(0, 10);
            return jobId ? (until ? { jobId, until } : { jobId }) : null;
          })
          .filter((p): p is PinnedJob => !!p),
      };
      const cur = await fetch(`${base}?ref=main`, { headers: GH_HEADERS(token) });
      const remoteFile = cur.ok ? ((await cur.json()) as { sha?: string; content?: string }) : {};
      const remote = remoteFile.content
        ? readConfig(JSON.parse(utf8fromB64(remoteFile.content)))
        : SPONSOR_CONFIG;
      const clean = mergeSponsorPublish(remote, local, loaded);
      const body = {
        message: "Admin : mise à jour des sponsors",
        content: b64utf8(JSON.stringify(clean, null, 2) + "\n"),
        branch: "main",
        ...(remoteFile.sha ? { sha: remoteFile.sha } : {}),
      };
      const r = await fetch(base, { method: "PUT", headers: GH_HEADERS(token), body: JSON.stringify(body) });
      if (r.ok) {
        setCfg(clean);
        dirtyRef.current = false;
        setDirty(false);
        setLoaded(true);
        setLiveSponsorConfig(clean);
        setStatus({
          k: "ok",
          msg: "✅ Publié — accueil et liste voient la vedette tout de suite ; le build suit.",
        });
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
              onChange={(e) => edit((c) => ({ ...c, contactEmail: e.target.value }))}
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
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Niveau :</span>
                    <select
                      value={s.tier ?? "argent"}
                      onChange={(e) => updateSponsor(i, { tier: parseSponsorTier(e.target.value) })}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="or">Or (bannière vedette, rotative)</option>
                      <option value="argent">Argent (grille compacte)</option>
                      <option value="bronze">Bronze (bandeau compact)</option>
                    </select>
                  </div>
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
            <h3 className="mb-2 font-semibold text-slate-700">Employeurs en vedette (pack Or — badge + carte accueil)</h3>
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

          {/* Offres Bronze épinglées */}
          <div>
            <h3 className="mb-2 font-semibold text-slate-700">
              Offres épinglées (pack Bronze — 7 jours, 2 max. en tête de liste)
            </h3>
            <div className="mb-2 space-y-2">
              {cfg.pinned.length === 0 && <p className="text-slate-500">Aucune offre épinglée.</p>}
              {cfg.pinned.map((p) => (
                <div key={p.jobId} className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-800">{p.jobId}</code>
                  <input
                    type="date"
                    value={p.until ?? ""}
                    onChange={(e) => patchPinned(p.jobId, e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                    title="Date de fin (incluse)"
                  />
                  <button
                    type="button"
                    onClick={() => removePinned(p.jobId)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Retirer
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={pinId}
                onChange={(e) => setPinId(e.target.value)}
                placeholder="Id d'offre (ex. 84d4276fd589a5b3)"
                className="min-w-[16rem] flex-1 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
              />
              <input
                type="date"
                value={pinUntil}
                onChange={(e) => setPinUntil(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
                title="Fin d'épingle (incluse)"
              />
              <button
                type="button"
                onClick={addPinned}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold hover:bg-slate-100"
              >
                + Épingler
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
            <span className="text-xs text-slate-400">
              {dirty ? "Modifications non publiées. " : ""}
              {loaded ? "Config GitHub chargée. " : "Chargement GitHub… "}
              Publier écrit tout le fichier (sponsors + vedettes + épingles) sans en effacer un autre.
            </span>
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
