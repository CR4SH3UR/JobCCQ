"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Ramène la fenêtre en haut à chaque changement de page. Next conserve parfois
 * la position de défilement lors d'une navigation côté client (surtout avec
 * l'en-tête collant) ; ceci garantit qu'on repart du haut de la nouvelle page.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
