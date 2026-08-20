"use client";

import { useState } from "react";
import type { FacetCount } from "@jobccq/shared";
import { cn } from "@/lib/format";

export function FacetGroup({
  title,
  options,
  selected,
  onToggle,
  initialVisible = 6,
}: {
  title: string;
  options: FacetCount[];
  selected: string[];
  onToggle: (id: string) => void;
  initialVisible?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (options.length === 0) return null;

  const shown = expanded ? options : options.slice(0, initialVisible);
  const selectedSet = new Set(selected);

  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <ul className="space-y-1">
        {shown.map((opt) => {
          const checked = selectedSet.has(opt.id);
          return (
            <li key={opt.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-slate-50",
                  checked && "font-medium text-brand-700",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(opt.id)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="flex-1 truncate">{opt.label}</span>
                <span className="text-xs text-slate-400">{opt.count}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {options.length > initialVisible && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 text-xs font-medium text-brand-600 hover:underline"
        >
          {expanded ? "Voir moins" : `Voir ${options.length - initialVisible} de plus`}
        </button>
      )}
    </div>
  );
}
