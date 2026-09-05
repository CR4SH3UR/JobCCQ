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
          <span
            className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-sm font-extrabold tracking-tight text-white"
            aria-hidden
          >
            JC
          </span>
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
