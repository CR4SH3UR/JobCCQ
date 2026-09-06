"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { BetaBanner } from "./BetaBanner";
import { ScrollToTop } from "./ScrollToTop";
import { CompareBar } from "./CompareBar";
import { OfflineBanner } from "./OfflineBanner";
import { hydrateSponsors } from "@/lib/sponsors-live";

/**
 * Chrome du site. Le widget `/embed/…` (iframe chez un employeur) n'affiche
 * ni en-tête, ni pied, ni barre de comparaison.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "";
  const embed = path.startsWith("/embed");
  useEffect(() => {
    void hydrateSponsors();
  }, []);

  if (embed) {
    return <main className="min-h-screen bg-slate-50">{children}</main>;
  }

  return (
    <>
      <ScrollToTop />
      <BetaBanner />
      <OfflineBanner />
      <Header />
      <main className="flex-1">{children}</main>
      <CompareBar />
      <Footer />
    </>
  );
}
