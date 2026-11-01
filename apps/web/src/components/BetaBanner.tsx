"use client";

import { useEffect, useState } from "react";
import { ContactEmailButton } from "@/components/ContactEmailButton";
import { useBannerConfig } from "@/lib/banner-live";
import type { BannerConfig, BannerTone } from "@/lib/banner";

/**
 * Mince bandeau d'annonce en haut du site (par défaut « Version beta… »).
 * Son contenu, sa couleur, son lien et sa visibilité sont **réglables dans la
 * console d'administration** (onglet « Bandeau » → `banner.json`). Rejetable :
 * le rejet est mémorisé par `id`, donc changer l'`id` ré-affiche le bandeau.
 */

/** Classes complètes par couleur (littérales pour que Tailwind les détecte). */
const TONES: Record<BannerTone, { wrap: string; close: string }> = {
  amber: {
    wrap: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100",
    close: "text-amber-700 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/50",
  },
  brand: {
    wrap: "border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-900/60 dark:bg-brand-950/40 dark:text-brand-100",
    close: "text-brand-700 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-900/50",
  },
  slate: {
    wrap: "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100",
    close: "text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700/60",
  },
  green: {
    wrap: "border-green-200 bg-green-50 text-green-900 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-100",
    close: "text-green-700 hover:bg-green-100 dark:text-green-200 dark:hover:bg-green-900/50",
  },
  red: {
    wrap: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100",
    close: "text-red-700 hover:bg-red-100 dark:text-red-200 dark:hover:bg-red-900/50",
  },
  blue: {
    wrap: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100",
    close: "text-blue-700 hover:bg-blue-100 dark:text-blue-200 dark:hover:bg-blue-900/50",
  },
};

/**
 * Rendu visuel pur du bandeau (sans logique de rejet). Réutilisé par l'aperçu
 * de la console admin. `onDismiss` affiche le bouton ✕.
 */
export function BannerView({ banner, onDismiss }: { banner: BannerConfig; onDismiss?: () => void }) {
  if (!banner.enabled || !banner.message.trim()) return null;
  const tone = TONES[banner.tone] ?? TONES.amber;

  return (
    <div className={`border-b ${tone.wrap}`}>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-sm">
        <span className="flex-1">
          {banner.emoji ? <span className="mr-1">{banner.emoji}</span> : null}
          {banner.title ? <strong>{banner.title}</strong> : null}
          {banner.title ? " " : null}
          {banner.message}
          {banner.link.kind !== "none" ? " " : null}
          {banner.link.kind === "contact" ? (
            <ContactEmailButton
              label={banner.link.label}
              subject={banner.link.subject}
              className="font-semibold underline underline-offset-2 hover:opacity-80"
            />
          ) : banner.link.kind === "url" ? (
            <a
              href={banner.link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2 hover:opacity-80"
            >
              {banner.link.label}
            </a>
          ) : null}
        </span>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Fermer le bandeau"
            className={`shrink-0 rounded p-1 leading-none ${tone.close}`}
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function BetaBanner() {
  const banner = useBannerConfig();
  const key = `banner-dismissed:${banner.id}`;

  // Masqué par défaut (évite un flash avant lecture du localStorage au montage).
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key) === "1");
    } catch {
      setHidden(false);
    }
  }, [key]);

  if (!banner.enabled || !banner.message.trim()) return null;
  if (banner.dismissible && hidden) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* stockage indisponible : on masque quand même pour la session */
    }
    setHidden(true);
  };

  return <BannerView banner={banner} onDismiss={banner.dismissible ? dismiss : undefined} />;
}
