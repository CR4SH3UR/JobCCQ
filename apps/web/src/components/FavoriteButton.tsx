"use client";

import { cn } from "@/lib/format";
import { toggleFavorite, useIsFavorite } from "@/lib/favorites";

/** Bouton « Ajouter aux favoris » libellé (pages de détail). */
export function FavoriteButton({ id, className }: { id: string; className?: string }) {
  const fav = useIsFavorite(id);
  return (
    <button
      type="button"
      onClick={() => toggleFavorite(id)}
      aria-pressed={fav}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors",
        fav
          ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
        className,
      )}
    >
      <span className="text-lg leading-none">{fav ? "♥" : "♡"}</span>
      {fav ? "Dans vos favoris" : "Ajouter aux favoris"}
    </button>
  );
}
