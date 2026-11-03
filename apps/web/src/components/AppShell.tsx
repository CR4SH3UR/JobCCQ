"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { BetaBanner } from "./BetaBanner";
import { ScrollToTop } from "./ScrollToTop";
import { CompareBar } from "./CompareBar";
import { OfflineBanner } from "./OfflineBanner";
import { MobileNav } from "./MobileNav";
import { hydrateSponsors } from "@/lib/sponsors-live";
import { hydrateBanner } from "@/lib/banner-live";

/**
 * Chrome du site. Le widget `/embed/…` (iframe chez un employeur) n'affiche
 * ni en-tête, ni pied, ni barre de comparaison.
 *
 * Sur téléphone : barre d'onglets fixe en bas + marge basse pour ne pas
 * masquer le contenu. Le pied de page reste visible (version compacte).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "";
  const embed = path.startsWith("/embed");
  useEffect(() => {
    void hydrateSponsors();
    void hydrateBanner();
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
      <main className="flex-1 pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        {children}
      </main>
      <CompareBar />
      <Footer />
      <MobileNav />
    </>
  );
}
