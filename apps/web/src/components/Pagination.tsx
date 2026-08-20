"use client";

import { cn } from "@/lib/format";

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const go = (p: number) => onChange(Math.min(Math.max(1, p), totalPages));

  // Fenêtre de pages autour de la page courante.
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);

  const btn = "min-w-9 rounded-lg border px-3 py-1.5 text-sm font-medium";

  return (
    <nav className="mt-6 flex items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => go(page - 1)}
        disabled={page <= 1}
        className={cn(btn, "border-slate-200 bg-white disabled:opacity-40")}
      >
        ‹
      </button>
      {start > 1 && <span className="px-1 text-slate-400">…</span>}
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => go(p)}
          className={cn(
            btn,
            p === page
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-slate-200 bg-white hover:bg-slate-50",
          )}
        >
          {p}
        </button>
      ))}
      {end < totalPages && <span className="px-1 text-slate-400">…</span>}
      <button
        type="button"
        onClick={() => go(page + 1)}
        disabled={page >= totalPages}
        className={cn(btn, "border-slate-200 bg-white disabled:opacity-40")}
      >
        ›
      </button>
    </nav>
  );
}
