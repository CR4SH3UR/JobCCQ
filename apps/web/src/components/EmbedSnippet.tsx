"use client";

import { useState } from "react";
import { embedSnippet, embedUrl } from "@/lib/embed";

/** Bloc « coller sur ton site » : aperçu de l'URL + copie du snippet iframe. */
export function EmbedSnippet({ slug, name }: { slug: string; name: string }) {
  const html = embedSnippet(slug, name);
  const url = embedUrl(slug);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponible */
    }
  };

  return (
    <section className="card mt-10 p-5">
      <h2 className="text-lg font-bold tracking-tight">Widget pour ton site</h2>
      <p className="mt-1 text-sm text-slate-600">
        Colle ce code sur la page carrières de {name} : tes offres JobCCQc s'affichent et se
        mettent à jour toutes seules.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-100">
        {html}
      </pre>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {copied ? "Copié" : "Copier le code"}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          Aperçu du widget ↗
        </a>
      </div>
    </section>
  );
}
