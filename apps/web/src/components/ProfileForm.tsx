"use client";

import { useState } from "react";
import {
  CCQ_TRADES,
  PROFILE_REGIONS,
  REMOTE_TYPES,
  type JobSeekerProfile,
} from "@jobccq/shared";
import { cn } from "@/lib/format";
import { saveProfile, useProfile } from "@/lib/profile";

/**
 * Formulaire de profil (métiers CCQ, régions, mobilité). Réutilisé par
 * l'onboarding accueil et la page « Mon profil ».
 */
export function ProfileForm({
  compact,
  submitLabel = "Enregistrer",
  onSaved,
}: {
  compact?: boolean;
  submitLabel?: string;
  onSaved?: (p: JobSeekerProfile) => void;
}) {
  const stored = useProfile();
  const [trades, setTrades] = useState<string[]>(stored.trades);
  const [regions, setRegions] = useState<string[]>(stored.regions);
  const [remote, setRemote] = useState<JobSeekerProfile["remote"]>(stored.remote);

  // Resync si le profil est vidé / modifié ailleurs (même onglet).
  const storedKey = `${stored.trades.join(",")}|${stored.regions.join(",")}|${stored.remote.join(",")}`;
  const [prevKey, setPrevKey] = useState(storedKey);
  if (prevKey !== storedKey) {
    setPrevKey(storedKey);
    setTrades(stored.trades);
    setRegions(stored.regions);
    setRemote(stored.remote);
  }

  const toggle = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const save = () => {
    const next = saveProfile({ trades, regions, remote });
    onSaved?.(next);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-4"
    >
      <ChipField
        title="Métiers"
        hint={compact ? "Un ou plusieurs métiers CCQ" : "Les métiers que tu cherches (conventions CCQ)."}
        options={CCQ_TRADES.map((t) => ({ id: t.id, label: t.label }))}
        selected={trades}
        onToggle={(id) => setTrades((cur) => toggle(cur, id))}
        compact={compact}
      />
      <ChipField
        title="Régions"
        hint="Où tu peux (ou veux) travailler."
        options={PROFILE_REGIONS.map((r) => ({ id: r.id, label: r.label }))}
        selected={regions}
        onToggle={(id) => setRegions((cur) => toggle(cur, id))}
        compact={compact}
      />
      <ChipField
        title="Mobilité"
        hint="Présentiel, hybride ou télétravail."
        options={REMOTE_TYPES.map((r) => ({ id: r.id, label: r.label }))}
        selected={remote}
        onToggle={(id) =>
          setRemote((cur) => toggle(cur, id) as JobSeekerProfile["remote"])
        }
        compact={compact}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function ChipField({
  title,
  hint,
  options,
  selected,
  onToggle,
  compact,
}: {
  title: string;
  hint: string;
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  compact?: boolean;
}) {
  const selectedSet = new Set(selected);
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-800">{title}</legend>
      <p className="mb-2 mt-0.5 text-xs text-slate-500">{hint}</p>
      <div
        className={cn(
          "flex flex-wrap gap-1.5",
          compact && "max-h-36 overflow-y-auto pr-1",
        )}
      >
        {options.map((o) => {
          const on = selectedSet.has(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onToggle(o.id)}
              aria-pressed={on}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                on
                  ? "border-brand-500 bg-brand-50 text-brand-800"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-200",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
