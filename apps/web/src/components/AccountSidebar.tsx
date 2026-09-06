"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useFavorites } from "@/lib/favorites";
import { useApplications } from "@/lib/applications";
import { useAlerts } from "@/lib/alerts";

type Tone = "green" | "red" | "amber";

const ICON: Record<string, string> = {
  "/profil": "👤",
  "/candidatures": "✓",
  "/favoris": "♥",
  "/alertes": "🔔",
  "/employeur": "🏗",
};
const NAV: { href: string; label: string; hint: string; tone: Tone }[] = [
  { href: "/profil", label: "Mon profil", hint: "Métiers, régions, mobilité", tone: "green" },
  { href: "/candidatures", label: "Mes candidatures", hint: "Où j'ai postulé", tone: "green" },
  { href: "/favoris", label: "Mes favoris", hint: "Offres sauvegardées", tone: "red" },
  { href: "/alertes", label: "Mes alertes", hint: "Courriels de nouvelles offres", tone: "amber" },
  { href: "/employeur", label: "Espace employeur", hint: "Réclamer, publier, stats", tone: "amber" },
];

const BUBBLE: Record<Tone, string> = {
  green: "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-300",
  red: "bg-red-100 text-red-500 dark:bg-red-500/20 dark:text-red-300",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300",
};
const BADGE: Record<Tone, string> = {
  green: "bg-green-600 text-white",
  red: "bg-red-500 text-white",
  amber: "bg-amber-500 text-white",
};

/** Menu latéral de l'espace utilisateur (candidatures, favoris, alertes). */
export function AccountSidebar() {
  const pathname = usePathname();
  const { user, enabled } = useAuth();
  const counts: Record<string, number> = {
    "/candidatures": useApplications().size,
    "/favoris": useFavorites().size,
    "/alertes": useAlerts().alerts.length,
  };

  return (
    <aside className="md:sticky md:top-20 md:w-72 md:shrink-0">
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 bg-gradient-to-br from-brand-50 to-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Mon espace</p>
          {enabled ? (
            user ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                <span className="truncate" title={user.email ?? ""}>{user.email}</span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">
                Connecte-toi (en haut) pour synchroniser sur tous tes appareils.
              </p>
            )
          ) : (
            <p className="mt-1 text-sm text-slate-500">Sauvegardé dans ce navigateur.</p>
          )}
        </div>

        <nav className="p-2">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const count = counts[item.href] ?? 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                  active
                    ? "bg-brand-50 ring-1 ring-brand-100 dark:bg-brand-500/20 dark:ring-brand-500/40"
                    : "hover:bg-slate-100",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg leading-none",
                    BUBBLE[item.tone],
                  )}
                >
                  {ICON[item.href]}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm font-semibold",
                      active ? "text-brand-800 dark:text-brand-200" : "text-slate-800",
                    )}
                  >
                    {item.label}
                  </span>
                  <span className="block truncate text-xs text-slate-500">{item.hint}</span>
                </span>
                {count > 0 && (
                  <span
                    className={cn(
                      "grid min-w-[1.4rem] shrink-0 place-items-center rounded-full px-1.5 py-0.5 text-xs font-bold",
                      BADGE[item.tone],
                    )}
                  >
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
