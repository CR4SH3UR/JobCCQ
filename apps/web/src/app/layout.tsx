import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl("/")),
  title: {
    default: "JobCCQ — Qui recrute au Québec ?",
    template: "%s",
  },
  description:
    "Agrégateur d'offres d'emploi du Québec et du Canada. Découvrez quelles entreprises recrutent, pour quels postes, et filtrez par région, domaine, salaire et plus.",
};

// Applique le thème avant le premier rendu (évite le flash clair→sombre).
const THEME_SCRIPT = `!function(){try{var e=localStorage.getItem("theme");e||(e=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"),document.documentElement.dataset.theme=e}catch(t){}}()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr-CA" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
