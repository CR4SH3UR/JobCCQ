"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMPARE_MAX, clearCompare, compareHref, useCompareIds } from "@/lib/compare";

/** Barre flottante : les offres cochées « comparer » (2–3). */
export function CompareBar() {
  const pathname = usePathname();
  const ids = useCompareIds();
  if (ids.length === 0) return null;
  if (pathname.startsWith("/admin") || pathname.startsWith("/emplois/comparer")) return null;

  return (
    <>
      <div className="h-16" aria-hidden />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 p-3">
      <div className="pointer-events-auto mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-white px-4 py-2.5 shadow-lg">
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-slate-900">{ids.length}</span> / {COMPARE_MAX} offre
          {ids.length > 1 ? "s" : ""} à comparer
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => clearCompare()}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Vider
          </button>
          <Link
            href={compareHref(ids)}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Comparer →
          </Link>
        </div>
      </div>
      </div>
    </>
  );
}
