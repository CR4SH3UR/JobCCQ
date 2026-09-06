"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SPONSORS, type Sponsor } from "@/lib/sponsors";
import { cn, initials } from "@/lib/format";
import { optimizedLogoUrl } from "@/lib/logo-url";

/**
 * Bannière de commandite — **or** (vedette rotative), **argent** (grille),
 * **bronze** (bandeau compact). S'il n'y a aucun commanditaire, affiche
 * l'encart « Votre entreprise ici » vers `/commandite`.
 */
const ROTATE_MS = 6000;

export function SponsorBanner({ className = "" }: { className?: string }) {
  const gold = SPONSORS.filter((s) => s.tier === "or");
  const silver = SPONSORS.filter((s) => (s.tier ?? "argent") === "argent");
  const bronze = SPONSORS.filter((s) => s.tier === "bronze");

  // La bannière vedette (rotative) prend le niveau le plus élevé présent.
  const hero = gold.length ? gold : silver;
  const heroGold = gold.length > 0;
  const grid = gold.length ? silver : [];

  if (hero.length === 0 && bronze.length === 0) {
    return <EmptyPrompt className={className} />;
  }

  return (
    <div className={className}>
      {hero.length > 0 && <Rotator list={hero} gold={heroGold} />}
      {grid.length > 0 && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {grid.map((s) => (
            <SilverMini key={s.id} s={s} />
          ))}
        </div>
      )}
      {bronze.length > 0 && <BronzeStrip list={bronze} className={hero.length ? "mt-2" : ""} />}
    </div>
  );
}

/** Bannière vedette rotative (fondu enchaîné, pause au survol, puces de navigation). */
function Rotator({ list, gold }: { list: Sponsor[]; gold: boolean }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (i >= list.length) setI(0);
  }, [list.length, i]);

  useEffect(() => {
    if (list.length < 2 || paused) return;
    const t = setInterval(() => setI((x) => (x + 1) % list.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [list.length, paused]);

  const current = list[Math.min(i, list.length - 1)];
  if (!current) return null;

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* key = fondu à chaque changement */}
      <div key={current.id} className="sponsor-fade">
        <BannerCard s={current} gold={gold} />
      </div>
      {list.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {list.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Commanditaire ${idx + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                idx === i
                  ? gold
                    ? "w-5 bg-amber-500"
                    : "w-5 bg-slate-400"
                  : "w-1.5 bg-slate-300 hover:bg-slate-400",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Grande bannière (niveau or ou argent). */
function BannerCard({ s, gold }: { s: Sponsor; gold: boolean }) {
  return (
    <a
      href={s.url}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className={cn(
        "group relative flex items-center gap-4 overflow-hidden rounded-2xl border p-5 transition-shadow",
        gold
          ? "border-amber-300/70 bg-gradient-to-br from-amber-50 to-amber-100/70 shadow-[0_10px_35px_-14px_rgba(202,138,4,0.5)] hover:shadow-[0_16px_44px_-12px_rgba(202,138,4,0.6)] dark:border-amber-700/50 dark:from-amber-950/40 dark:to-amber-900/20"
          : "border-slate-300 bg-gradient-to-br from-slate-100 to-white shadow-sm hover:shadow-md",
      )}
    >
      {/* Halo décoratif */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full blur-3xl",
          gold ? "bg-amber-300/40 dark:bg-amber-500/20" : "bg-slate-300/40",
        )}
      />
      {/* Médaille / niveau (coin) */}
      <span
        className={cn(
          "absolute right-0 top-0 rounded-bl-xl px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm",
          gold
            ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950"
            : "bg-slate-200 text-slate-600",
        )}
      >
        {gold ? "Or" : "Argent"}
      </span>

      <Logo s={s} size={gold ? "lg" : "md"} gold={gold} />

      <div className="min-w-0 flex-1 pr-4">
        <p
          className={cn(
            "truncate font-extrabold text-slate-900",
            gold ? "text-lg sm:text-xl" : "text-base",
          )}
        >
          {s.name}
        </p>
        <p className="line-clamp-2 text-sm text-slate-600">{s.tagline}</p>
      </div>

      <span
        className={cn(
          "hidden shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform group-hover:scale-105 sm:inline",
          gold ? "bg-gradient-to-r from-amber-500 to-yellow-600" : "bg-brand-600",
        )}
      >
        Visiter →
      </span>
    </a>
  );
}

/** Carte argent compacte (grille sous la bannière vedette). */
function SilverMini({ s }: { s: Sponsor }) {
  return (
    <a
      href={s.url}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-slate-300 bg-gradient-to-br from-slate-100 to-white p-3.5 shadow-sm transition-shadow hover:shadow-md"
    >
      <span className="absolute right-0 top-0 rounded-bl-lg bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
        Argent
      </span>
      <Logo s={s} size="sm" gold={false} />
      <div className="min-w-0 pr-12">
        <p className="truncate font-semibold text-slate-900 group-hover:text-brand-700">{s.name}</p>
        <p className="truncate text-xs text-slate-500">{s.tagline}</p>
      </div>
    </a>
  );
}

function Logo({ s, size, gold }: { s: Sponsor; size: "xs" | "sm" | "md" | "lg"; gold: boolean }) {
  const dim =
    size === "lg" ? "h-16 w-16" : size === "md" ? "h-12 w-12" : size === "sm" ? "h-11 w-11" : "h-6 w-6";
  const src = optimizedLogoUrl(
    s.logoUrl,
    size === "lg" ? 128 : size === "md" ? 96 : size === "sm" ? 88 : 48,
  );
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={s.name}
        width={size === "lg" ? 64 : size === "md" ? 48 : size === "sm" ? 44 : 24}
        height={size === "lg" ? 64 : size === "md" ? 48 : size === "sm" ? 44 : 24}
        loading="lazy"
        decoding="async"
        className={cn(
          dim,
          "shrink-0 bg-white object-contain ring-1 ring-slate-200",
          size === "xs" ? "rounded-md p-0.5" : "rounded-xl p-1",
        )}
      />
    );
  }
  return (
    <span
      className={cn(
        dim,
        "grid shrink-0 place-items-center font-bold ring-1",
        size === "xs" ? "rounded-md text-[10px]" : "rounded-xl text-sm",
        gold
          ? "bg-white text-amber-700 ring-amber-200 dark:bg-amber-950/30"
          : "bg-brand-50 text-brand-700 ring-brand-100",
      )}
    >
      {initials(s.name)}
    </span>
  );
}

/** Bandeau compact (niveau bronze) : logos + nom, sous Or/Argent. */
function BronzeStrip({ list, className }: { list: Sponsor[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Bronze
      </span>
      {list.map((s) => (
        <a
          key={s.id}
          href={s.url}
          target="_blank"
          rel="sponsored noopener noreferrer"
          title={s.tagline || s.name}
          className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50/70 px-2.5 py-1 text-xs font-medium text-orange-950 hover:border-orange-300 hover:bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-100"
        >
          <Logo s={s} size="xs" gold={false} />
          <span className="max-w-[10rem] truncate">{s.name}</span>
        </a>
      ))}
    </div>
  );
}

/** Encart « Votre entreprise ici » quand aucun commanditaire n'est configuré. */
function EmptyPrompt({ className }: { className: string }) {
  return (
    <Link
      href="/commandite"
      className={cn(
        "card group flex w-full items-center justify-between gap-4 border-dashed p-4 text-left text-sm transition-colors hover:border-brand-400 hover:bg-brand-50/40",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-lg ring-1 ring-brand-100">
          📣
        </span>
        <div>
          <p className="font-semibold text-slate-800">Votre entreprise ici</p>
          <p className="text-slate-500">
            Trois packs — Argent, Or, Bronze (offre épinglée). Tarifs et contact sur la page
            commandite.
          </p>
        </div>
      </div>
      <span className="hidden shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-transform group-hover:scale-105 sm:inline">
        Voir les packs
      </span>
    </Link>
  );
}
