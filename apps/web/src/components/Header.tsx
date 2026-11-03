"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { adminAllowlistConfigured, isAdminEmail, useAuth } from "@/lib/auth";
import { cn } from "@/lib/format";
import { ThemeToggle } from "./ThemeToggle";
import { LangToggle } from "./LangToggle";
import { AuthButton } from "./AuthButton";
import { UI, useUiLang } from "@/lib/i18n";

/** Routes de l'espace utilisateur (menu latéral commun). */
const COMPTE = ["/candidatures", "/favoris", "/alertes", "/profil", "/employeur"];

function BrandMark({ className = "h-9 w-9" }: { className?: string }) {
  const gid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${gid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f68f7" />
          <stop offset="1" stopColor="#1a34d8" />
        </linearGradient>
        <linearGradient id={`${gid}-hat`} x1="0.2" y1="0.05" x2="0.8" y2="1">
          <stop offset="0" stopColor="#FF8A45" />
          <stop offset="0.55" stopColor="#FF5F15" />
          <stop offset="1" stopColor="#EA5109" />
        </linearGradient>
        <linearGradient id={`${gid}-brim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EA5109" />
          <stop offset="1" stopColor="#D2470A" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gid}-bg)`} />
      <path
        d="M3.6 20.4 C8 22.4 24 22.4 28.4 20.4 C29.3 21.9 27.4 24 22.6 24.9 C19 25.5 13 25.5 9.4 24.9 C4.6 24 2.7 21.9 3.6 20.4 Z"
        fill={`url(#${gid}-brim)`}
      />
      <path
        d="M6.6 20.6 C6.6 12.2 10.7 6.4 16 6.4 C21.3 6.4 25.4 12.2 25.4 20.6 Q16 22.2 6.6 20.6 Z"
        fill={`url(#${gid}-hat)`}
      />
      <g stroke="#B23C05" strokeWidth="1.15" strokeLinecap="round" fill="none" opacity="0.85">
        <path d="M16 7.4 V19.8" />
        <path d="M11.7 19.8 C11.9 12.9 13.5 8.8 15.2 7.8" />
        <path d="M20.3 19.8 C20.1 12.9 18.5 8.8 16.8 7.8" />
      </g>
      <ellipse cx="16" cy="6.7" rx="1.5" ry="1.05" fill="#B23C05" />
      <path
        d="M10.2 12.2 C11.2 9.8 13 8.2 15 7.8"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.32"
      />
    </svg>
  );
}

export function Header() {
  const pathname = usePathname();
  const { user, enabled } = useAuth();
  const lang = useUiLang();
  const L = UI[lang];
  const [menuOpen, setMenuOpen] = useState(false);

  const LINKS = [
    { href: "/", label: L.home },
    { href: "/emplois", label: L.jobs },
    { href: "/entreprises", label: L.hiring },
    { href: "/marche", label: L.market },
    { href: "/salaire", label: L.salary },
    { href: "/sources", label: L.sources },
  ];

  /** Liens secondaires (hors barre d'onglets mobile). */
  const MORE = [
    { href: "/marche", label: L.market },
    { href: "/salaire", label: L.salary },
    { href: "/guides", label: lang === "en" ? "Career guides" : "Guides carrière" },
    { href: "/emplois/carte", label: L.map },
    { href: "/emplois/ville", label: lang === "en" ? "By city" : "Par ville" },
    { href: "/sources", label: L.sources },
  ];

  const compteActive = COMPTE.some((h) => pathname.startsWith(h));
  const adminActive = pathname.startsWith("/admin");
  const showAdmin = enabled && adminAllowlistConfigured && isAdminEmail(user?.email);

  // Ferme le tiroir au changement de route.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Bloque le scroll derrière le menu plein écran.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  // Le menu mobile est un frère du <header> (pas un enfant) : `backdrop-filter`
  // sur le header créerait sinon un containing block qui piège position:fixed.
  return (
    <>
      <header
        className={cn(
          "sticky top-0 border-b border-slate-200 bg-white/90 backdrop-blur",
          menuOpen ? "z-[60]" : "z-30",
        )}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 md:gap-3 md:px-4 md:py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="JobCCQc — accueil">
            <BrandMark />
            <span className="truncate text-base font-bold tracking-tight md:text-lg">
              Job<span className="text-brand-600">CCQc</span>
            </span>
          </Link>

          {/* Nav desktop */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
            {LINKS.map((l) => {
              const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
            <Link
              href="/candidatures"
              title="Mon espace — profil, candidatures, favoris, alertes"
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                compteActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <span aria-hidden>👤</span>
              <span>{L.account}</span>
            </Link>
            {showAdmin && (
              <Link
                href="/admin"
                title="Panel admin"
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                  adminActive
                    ? "bg-brand-600 text-white"
                    : "border border-brand-200 text-brand-700 hover:bg-brand-50",
                )}
              >
                Admin
              </Link>
            )}
            <LangToggle />
            <ThemeToggle />
            <AuthButton />
          </nav>

          {/* Actions compactes mobile */}
          <div className="flex items-center gap-1 md:hidden">
            <Link
              href="/emplois"
              aria-label={L.jobs}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 active:bg-slate-100"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M16.5 16.5 20 20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </Link>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="mobile-more-menu"
              aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 active:bg-slate-100"
            >
              {menuOpen ? (
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
                  <path
                    d="M4 7h16M4 12h16M4 17h16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Tiroir plein écran — frère du header pour éviter le piège backdrop-filter */}
      {menuOpen && (
        <div
          id="mobile-more-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 md:hidden"
          style={{
            paddingTop: "calc(3rem + env(safe-area-inset-top, 0px))",
            paddingBottom: "calc(3.75rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="mx-auto max-w-lg space-y-3 px-3 py-3">
            <section className="card overflow-hidden">
              <p className="border-b border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Explorer
              </p>
              <ul>
                {MORE.map((l) => {
                  const active = pathname.startsWith(l.href);
                  return (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className={cn(
                          "flex items-center justify-between border-b border-slate-100 px-3 py-2.5 text-sm font-medium last:border-0",
                          active
                            ? "bg-brand-50 text-brand-700"
                            : "text-slate-800 active:bg-slate-50",
                        )}
                      >
                        {l.label}
                        <span className="text-slate-300" aria-hidden>
                          ›
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="card overflow-hidden">
              <p className="border-b border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {L.account}
              </p>
              <ul>
                {[
                  { href: "/profil", label: lang === "en" ? "My profile" : "Mon profil" },
                  {
                    href: "/candidatures",
                    label: lang === "en" ? "Applications" : "Candidatures",
                  },
                  { href: "/favoris", label: lang === "en" ? "Saved" : "Favoris" },
                  { href: "/alertes", label: lang === "en" ? "Alerts" : "Alertes" },
                  {
                    href: "/employeur",
                    label: lang === "en" ? "Employer space" : "Espace employeur",
                  },
                ].map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className={cn(
                        "flex items-center justify-between border-b border-slate-100 px-3 py-2.5 text-sm font-medium last:border-0",
                        pathname.startsWith(l.href)
                          ? "bg-brand-50 text-brand-700"
                          : "text-slate-800 active:bg-slate-50",
                      )}
                    >
                      {l.label}
                      <span className="text-slate-300" aria-hidden>
                        ›
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {showAdmin && (
              <Link
                href="/admin"
                className="flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Admin
              </Link>
            )}

            <div className="card flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="text-sm font-medium text-slate-600">Préférences</span>
              <div className="flex items-center gap-2">
                <LangToggle />
                <ThemeToggle />
                <AuthButton />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
