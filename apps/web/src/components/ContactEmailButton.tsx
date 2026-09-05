"use client";

import { useEffect, useState } from "react";
import { LEGAL } from "@/lib/legal";

type Props = {
  email?: string;
  label?: string;
  subject?: string;
  className?: string;
  children?: React.ReactNode;
};

export function ContactEmailButton({
  email = LEGAL.contactEmail,
  label,
  subject,
  className,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children ?? label ?? email}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <button
            type="button"
            aria-label="Fermer la fenêtre de contact"
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-email-title"
            className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 text-left shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <h2 id="contact-email-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Nous écrire
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Copie l'adresse ci-dessous et colle-la dans ton application courriel.
            </p>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
              <p className="text-xs font-semibold uppercase text-slate-500">Courriel</p>
              <p className="mt-1 break-all font-mono text-sm text-slate-900 dark:text-slate-100">
                {email}
              </p>
              {subject && (
                <>
                  <p className="mt-3 text-xs font-semibold uppercase text-slate-500">Sujet suggéré</p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{subject}</p>
                </>
              )}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => void copyEmail()}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                {copied ? "Copié" : "Copier l'adresse"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
