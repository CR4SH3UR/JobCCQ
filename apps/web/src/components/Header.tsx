"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminAllowlistConfigured, isAdminEmail, useAuth } from "@/lib/auth";
import { cn } from "@/lib/format";
import { ThemeToggle } from "./ThemeToggle";
import { AuthButton } from "./AuthButton";

const LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/emplois", label: "Emplois" },
  { href: "/entreprises", label: "Qui recrute" },
  { href: "/sources", label: "Sources" },
];

/** Routes de l'espace utilisateur (menu latéral commun). */
const COMPTE = ["/candidatures", "/favoris", "/alertes"];

export function Header() {
  const pathname = usePathname();
  const { user, enabled } = useAuth();
  const compteActive = COMPTE.some((h) => pathname.startsWith(h));
  const adminActive = pathname.startsWith("/admin");
  const showAdmin = enabled && adminAllowlistConfigured && isAdminEmail(user?.email);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2" aria-label="JobCCQc — accueil">
          <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden>
            <defs>
              <linearGradient id="jccqBg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3f68f7" />
                <stop offset="1" stopColor="#1a34d8" />
              </linearGradient>
              <linearGradient id="jccqHat" x1="0.2" y1="0.05" x2="0.8" y2="1">
                <stop offset="0" stopColor="#FF9248" />
                <stop offset="0.55" stopColor="#F06D1B" />
                <stop offset="1" stopColor="#D2531A" />
              </linearGradient>
              <linearGradient id="jccqBrim" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#E4600F" />
                <stop offset="1" stopColor="#B8460F" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill="url(#jccqBg)" />
            <path
              d="M3.6 20.4 C8 22.4 24 22.4 28.4 20.4 C29.3 21.9 27.4 24 22.6 24.9 C19 25.5 13 25.5 9.4 24.9 C4.6 24 2.7 21.9 3.6 20.4 Z"
              fill="url(#jccqBrim)"
            />
            <path
              d="M6.6 20.6 C6.6 12.2 10.7 6.4 16 6.4 C21.3 6.4 25.4 12.2 25.4 20.6 Q16 22.2 6.6 20.6 Z"
              fill="url(#jccqHat)"
            />
            <g stroke="#C24E12" strokeWidth="1.15" strokeLinecap="round" fill="none" opacity="0.85">
              <path d="M16 7.4 V19.8" />
              <path d="M11.7 19.8 C11.9 12.9 13.5 8.8 15.2 7.8" />
              <path d="M20.3 19.8 C20.1 12.9 18.5 8.8 16.8 7.8" />
            </g>
            <ellipse cx="16" cy="6.7" rx="1.5" ry="1.05" fill="#C24E12" />
            <path
              d="M10.2 12.2 C11.2 9.8 13 8.2 15 7.8"
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.32"
            />
          </svg>
          <span className="text-lg font-bold tracking-tight">
            Job<span className="text-brand-600">CCQc</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
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
            title="Mon espace — candidatures, favoris, alertes"
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              compteActive
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <span aria-hidden>👤</span>
            <span className="hidden sm:inline">Mon espace</span>
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
          <ThemeToggle />
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}
