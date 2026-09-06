import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { SentryBoot } from "@/components/SentryBoot";
import { siteUrl } from "@/lib/site";

// Analytics léger et respectueux de la vie privée (Plausible), activé seulement
// si NEXT_PUBLIC_PLAUSIBLE_DOMAIN est défini au build. Aucun cookie, aucune
// donnée personnelle → pas de bannière de consentement requise. `SRC` permet de
// pointer vers une instance auto-hébergée si besoin.
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
const PLAUSIBLE_SRC = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ?? "https://plausible.io/js/script.js";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl("/")),
  title: {
    default: "JobCCQc — Qui recrute au Québec ?",
    template: "%s",
  },
  description:
    "Agrégateur d'offres d'emploi du Québec et du Canada. Découvrez quelles entreprises recrutent, pour quels postes, et filtrez par région, domaine, salaire et plus.",
  alternates: {
    types: {
      "application/rss+xml": siteUrl("/emplois.rss"),
    },
  },
};

// Applique le thème avant le premier rendu (évite le flash clair→sombre).
const THEME_SCRIPT = `!function(){try{var e=localStorage.getItem("theme");e||(e=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"),document.documentElement.dataset.theme=e;var l=localStorage.getItem("jobccq:lang");if(l==="en")document.documentElement.lang="en-CA"}catch(t){}}()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr-CA" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {PLAUSIBLE_DOMAIN && <script defer data-domain={PLAUSIBLE_DOMAIN} src={PLAUSIBLE_SRC} />}
      </head>
      <body className="min-h-screen flex flex-col">
        <SentryBoot />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
