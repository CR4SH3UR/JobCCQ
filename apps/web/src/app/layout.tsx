import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "JobCCQ — Qui recrute au Québec ?",
  description:
    "Agrégateur d'offres d'emploi du Québec et du Canada. Découvrez quelles entreprises recrutent, pour quels postes, et filtrez par région, domaine, salaire et plus.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr-CA">
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
