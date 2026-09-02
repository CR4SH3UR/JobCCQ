"use client";

import { cn } from "@/lib/format";
import { toggleApplied, useHasApplied } from "@/lib/applications";

/** Bouton « J'ai postulé » libellé (pages de détail) — crochet vert une fois marqué. */
export function AppliedButton({ id, className }: { id: string; className?: string }) {
  const applied = useHasApplied(id);
  return (
    <button
      type="button"
      onClick={() => toggleApplied(id)}
      aria-pressed={applied}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors",
        applied
          ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
        className,
      )}
    >
      <span className="text-lg leading-none">{applied ? "✓" : "＋"}</span>
      {applied ? "Vous avez postulé" : "Marquer comme postulé"}
    </button>
  );
}
