"use client";

import { useEffect, useRef, useState } from "react";
import {
  BANNER_CONFIG,
  BANNER_TONES,
  readBannerConfig,
  type BannerConfig,
  type BannerLink,
  type BannerTone,
} from "@/lib/banner";
import { bannerRawUrl, setLiveBannerConfig } from "@/lib/banner-live";
import { BannerView } from "@/components/BetaBanner";

/**
 * Éditeur du bandeau d'annonce (console d'administration).
 *
 * Édite `apps/web/src/data/banner.json` : texte, couleur, lien, visibilité.
 * « Publier » écrit le fichier sur GitHub (même mécanisme que les sponsors) →
 * les visiteurs voient le changement tout de suite (hydratation live), le build
 * suit. Réutilise le jeton GitHub du panneau principal (localStorage).
 */
const LS_TOKEN = "admin:ghtoken";
const PATH = "apps/web/src/data/banner.json";

const TONE_LABELS: Record<BannerTone, string> = {
  amber: "Ambre",
  brand: "Marque",
  slate: "Ardoise",
  green: "Vert",
  red: "Rouge",
  blue: "Bleu",
};

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

const FIELD =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export function AdminBanner() {
  const [cfg, setCfg] = useState<BannerConfig>(BANNER_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const dirtyRef = useRef(false);
  const [status, setStatus] = useState<{ k: "idle" | "run" | "ok" | "err"; msg?: string }>({ k: "idle" });

  const edit = (patch: Partial<BannerConfig>) => {
    dirtyRef.current = true;
    setCfg((c) => ({ ...c, ...patch }));
  };
  const editLink = (link: BannerLink) => edit({ link });

  // Charge GitHub `main` une fois (repli : raw). N'écrase pas une saisie commencée.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = readToken();
        const { owner, repo } = ghRepo();
        let parsed: BannerConfig | null = null;
        if (token) {
          const r = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${PATH}?ref=main`,
            { headers: GH_HEADERS(token), cache: "no-store" },
          );
          if (r.ok) {
            const d = (await r.json()) as { content?: string };
            if (d.content) parsed = readBannerConfig(JSON.parse(utf8fromB64(d.content)));
          }
        }
        if (!parsed) {
          const r = await fetch(bannerRawUrl(), { cache: "no-store" });
          if (r.ok) parsed = readBannerConfig(await r.json());
        }
        if (!alive || !parsed || dirtyRef.current) return;
        setCfg(parsed);
        setLiveBannerConfig(parsed);
        setLoaded(true);
      } catch {
        /* garde le bundle */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
      const clean = readBannerConfig(cfg); // normalise (replis sûrs)
      const cur = await fetch(`${base}?ref=main`, { headers: GH_HEADERS(token) });
      const remoteFile = cur.ok ? ((await cur.json()) as { sha?: string }) : {};
      const body = {
        message: "Admin : mise à jour du bandeau d'annonce",
        content: b64utf8(JSON.stringify(clean, null, 2) + "\n"),
        branch: "main",
        ...(remoteFile.sha ? { sha: remoteFile.sha } : {}),
      };
      const r = await fetch(base, { method: "PUT", headers: GH_HEADERS(token), body: JSON.stringify(body) });
      if (r.ok) {
        setCfg(clean);
        dirtyRef.current = false;
        setLoaded(true);
        setLiveBannerConfig(clean);
        setStatus({ k: "ok", msg: "✅ Publié — le bandeau change tout de suite ; le build suit." });
      } else {
        const d = await r.json().catch(() => ({}));
        setStatus({ k: "err", msg: (d as { message?: string }).message ?? `HTTP ${r.status}` });
      }
    } catch (e) {
      setStatus({ k: "err", msg: (e as Error).message });
    }
  };

  const link = cfg.link;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-10">
      <div className="card p-4">
        <h2 className="text-lg font-bold tracking-tight">📢 Bandeau d'annonce</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Le mince bandeau en haut du site (par défaut « Version beta… »). Les changements
          apparaissent dès la publication ; le redéploiement suit.
        </p>

        {/* Aperçu en direct */}
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <p className="bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800">
            Aperçu
          </p>
          <PreviewBanner cfg={cfg} />
        </div>

        <div className="mt-4 grid gap-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => edit({ enabled: e.target.checked })}
            />
            Afficher le bandeau
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Émoji (optionnel)">
              <input className={FIELD} value={cfg.emoji} maxLength={4} onChange={(e) => edit({ emoji: e.target.value })} />
            </Field>
            <Field label="Couleur">
              <select className={FIELD} value={cfg.tone} onChange={(e) => edit({ tone: e.target.value as BannerTone })}>
                {BANNER_TONES.map((t) => (
                  <option key={t} value={t}>
                    {TONE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Titre en gras (optionnel)">
            <input className={FIELD} value={cfg.title} onChange={(e) => edit({ title: e.target.value })} />
          </Field>
          <Field label="Message">
            <textarea className={FIELD} rows={2} value={cfg.message} onChange={(e) => edit({ message: e.target.value })} />
          </Field>

          {/* Lien d'action */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lien d'action">
              <select
                className={FIELD}
                value={link.kind}
                onChange={(e) => {
                  const kind = e.target.value as BannerLink["kind"];
                  if (kind === "none") editLink({ kind: "none" });
                  else if (kind === "url") editLink({ kind: "url", label: "En savoir plus", href: "https://" });
                  else editLink({ kind: "contact", label: "Nous écrire", subject: "Retour — JobCCQc" });
                }}
              >
                <option value="none">Aucun</option>
                <option value="contact">Contact courriel (modale)</option>
                <option value="url">Lien externe</option>
              </select>
            </Field>
            {link.kind !== "none" ? (
              <Field label="Libellé du lien">
                <input
                  className={FIELD}
                  value={link.label}
                  onChange={(e) => editLink({ ...link, label: e.target.value })}
                />
              </Field>
            ) : null}
          </div>
          {link.kind === "url" ? (
            <Field label="URL de destination">
              <input className={FIELD} value={link.href} onChange={(e) => editLink({ ...link, href: e.target.value })} />
            </Field>
          ) : null}
          {link.kind === "contact" ? (
            <Field label="Sujet du courriel">
              <input
                className={FIELD}
                value={link.subject}
                onChange={(e) => editLink({ ...link, subject: e.target.value })}
              />
            </Field>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={cfg.dismissible}
                onChange={(e) => edit({ dismissible: e.target.checked })}
              />
              Fermable par le visiteur
            </label>
            <Field label="Version (id)">
              <input
                className={FIELD}
                value={cfg.id}
                onChange={(e) => edit({ id: e.target.value })}
                placeholder="ex. beta-2026"
              />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-slate-500">
            Changer la « version » ré-affiche le bandeau à tous ceux qui l'avaient fermé.
          </p>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={publish}
            disabled={status.k === "run"}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {status.k === "run" ? "Publication…" : "Publier"}
          </button>
          {status.k === "ok" ? <span className="text-sm text-green-700 dark:text-green-400">{status.msg}</span> : null}
          {status.k === "err" ? <span className="text-sm text-red-700 dark:text-red-400">{status.msg}</span> : null}
          {!loaded && status.k === "idle" ? (
            <span className="text-xs text-slate-500">Chargement de la config publiée…</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      {children}
    </label>
  );
}

/** Aperçu statique (toujours visible, sans logique de rejet). */
function PreviewBanner({ cfg }: { cfg: BannerConfig }) {
  if (!cfg.enabled || !cfg.message.trim()) {
    return <p className="px-3 py-2 text-sm text-slate-400">Bandeau masqué.</p>;
  }
  return <BannerView banner={cfg} />;
}
