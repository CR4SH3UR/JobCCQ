"use client";

import { useEffect, useState } from "react";

/**
 * Bascule FR/EN de l'interface (libellés du chrome). Les offres restent dans
 * leur langue d'origine — voir `translate-job.ts` pour un titre glosé.
 */
export type UiLang = "fr" | "en";

const KEY = "jobccq:lang";

export const UI: Record<UiLang, Record<string, string>> = {
  fr: {
    home: "Accueil",
    jobs: "Emplois",
    hiring: "Qui recrute",
    sources: "Sources",
    map: "Carte",
    account: "Mon espace",
    search: "Poste, métier, entreprise…",
    city: "Ville (ex. Montréal)",
    radius: "À moins de",
    langToggle: "English",
  },
  en: {
    home: "Home",
    jobs: "Jobs",
    hiring: "Who's hiring",
    sources: "Sources",
    map: "Map",
    account: "My account",
    search: "Role, trade, company…",
    city: "City (e.g. Montreal)",
    radius: "Within",
    langToggle: "Français",
  },
};

export function readLang(): UiLang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "en" || v === "fr") return v;
  } catch {
    /* ignore */
  }
  return "fr";
}

export function writeLang(lang: UiLang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") document.documentElement.lang = lang === "en" ? "en-CA" : "fr-CA";
}

export function useUiLang(): UiLang {
  const [lang, setLang] = useState<UiLang>("fr");
  useEffect(() => {
    setLang(readLang());
    const on = () => setLang(readLang());
    window.addEventListener("jobccq:lang", on);
    return () => window.removeEventListener("jobccq:lang", on);
  }, []);
  return lang;
}
