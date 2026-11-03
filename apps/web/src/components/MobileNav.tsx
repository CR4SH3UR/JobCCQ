"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";
import { UI, useUiLang } from "@/lib/i18n";
import { useFavorites } from "@/lib/favorites";
import { useApplications } from "@/lib/applications";

/**
 * Barre d'onglets fixe en bas — chrome principal sur téléphone.
 * Thème marque (bleu Québec), compact pour les petits écrans.
 */
export function MobileNav() {
  const pathname = usePathname() ?? "";
  const lang = useUiLang();
  const L = UI[lang];
  const favCount = useFavorites().size;
  const appCount = useApplications().size;
  const compteBadge = favCount + appCount;

  if (pathname.startsWith("/admin") || pathname.startsWith("/embed")) return null;

  const tabs: {
    href: string;
    label: string;
    match: (p: string) => boolean;
    icon: (active: boolean) => React.ReactNode;
    badge?: number;
  }[] = [
    {
      href: "/",
      label: L.home ?? "Accueil",
      match: (p) => p === "/",
      icon: (a) => <HomeIcon active={a} />,
    },
    {
      href: "/emplois",
      label: L.jobs ?? "Emplois",
      match: (p) => p.startsWith("/emplois"),
      icon: (a) => <BriefcaseIcon active={a} />,
    },
    {
      href: "/entreprises",
      label: L.hiring ?? "Qui recrute",
      match: (p) => p.startsWith("/entreprises"),
      icon: (a) => <BuildingIcon active={a} />,
    },
    {
      href: "/candidatures",
      label: L.account ?? "Mon espace",
      match: (p) =>
        ["/candidatures", "/favoris", "/alertes", "/profil", "/employeur"].some((h) =>
          p.startsWith(h),
        ),
      icon: (a) => <UserIcon active={a} />,
      badge: compteBadge > 0 ? compteBadge : undefined,
    },
  ];

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-brand-700/65 text-white shadow-[0_-10px_28px_rgba(26,52,216,0.22)] backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-brand-700/55 md:hidden dark:border-white/5 dark:bg-brand-950/55 dark:supports-[backdrop-filter]:bg-brand-950/45"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        WebkitBackdropFilter: "blur(20px) saturate(1.5)",
      }}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4 px-0.5 pb-0.5 pt-1">
        {tabs.map((t) => {
          const active = t.match(pathname);
          return (
            <li key={t.href} className="min-w-0">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 text-[10px] font-semibold leading-tight tracking-tight transition-colors",
                  active
                    ? "bg-white/15 text-white"
                    : "text-brand-100/85 active:bg-white/10 active:text-white",
                )}
              >
                <span className="relative">
                  {t.icon(active)}
                  {t.badge != null && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-orange-400 px-1 text-[8px] font-bold text-white shadow-sm">
                      {t.badge > 9 ? "9+" : t.badge}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
      />
    </svg>
  );
}

function BriefcaseIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
        strokeLinecap="round"
      />
      <rect
        x="3.5"
        y="7"
        width="17"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
      />
      <path d="M3.5 12h17" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
    </svg>
  );
}

function BuildingIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M4 20V6.5A1.5 1.5 0 0 1 5.5 5H12v15H4Zm8 0V9h6.5A1.5 1.5 0 0 1 20 10.5V20h-8Z"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
      />
      <path
        d="M7 9h2M7 12h2M7 15h2M15 12h2M15 15h2"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
        strokeLinecap="round"
      />
    </svg>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="9"
        r="3.25"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
      />
      <path
        d="M5.5 19.5c1.4-3 4-4.5 6.5-4.5s5.1 1.5 6.5 4.5"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
        strokeLinecap="round"
      />
    </svg>
  );
}
