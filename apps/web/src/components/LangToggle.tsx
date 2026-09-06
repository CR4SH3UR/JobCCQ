"use client";

import { useEffect, useState } from "react";
import { readLang, writeLang, UI, type UiLang } from "@/lib/i18n";

export function LangToggle() {
  const [lang, setLang] = useState<UiLang>("fr");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setLang(readLang());
    setMounted(true);
  }, []);
  if (!mounted) return null;
  const next: UiLang = lang === "fr" ? "en" : "fr";
  return (
    <button
      type="button"
      onClick={() => {
        writeLang(next);
        setLang(next);
        window.dispatchEvent(new Event("jobccq:lang"));
      }}
      aria-label={lang === "fr" ? "Switch to English" : "Passer en français"}
      title={UI[lang].langToggle}
      className="rounded-lg px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      {lang === "fr" ? "EN" : "FR"}
    </button>
  );
}
