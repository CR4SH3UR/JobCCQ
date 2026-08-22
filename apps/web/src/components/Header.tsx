"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";
import { ThemeToggle } from "./ThemeToggle";
import { AuthButton } from "./AuthButton";
import { useFavorites } from "@/lib/favorites";

const LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/emplois", label: "Emplois" },
  { href: "/entreprises", label: "Qui recrute" },
  { href: "/sources", label: "Sources" },
];

export function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 font-bold text-white">
            J
          </span>
          <span className="text-lg font-bold tracking-tight">
            Job<span className="text-brand-600">CCQ</span>
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
          <FavLink active={pathname.startsWith("/favoris")} />
          <ThemeToggle />
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}

/** Lien « Favoris » avec le compteur d'offres sauvegardées (navigateur). */
function FavLink({ active }: { active: boolean }) {
  const count = useFavorites().size;
  return (
    <Link
      href="/favoris"
      title="Mes favoris"
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-brand-50 text-brand-700"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      <span className={active ? "text-red-500" : ""}>{count > 0 ? "♥" : "♡"}</span>
      <span className="hidden sm:inline">Favoris</span>
      {count > 0 && (
        <span className="grid min-w-[1.25rem] place-items-center rounded-full bg-brand-600 px-1 text-xs font-semibold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
