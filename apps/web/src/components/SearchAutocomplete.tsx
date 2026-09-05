"use client";

import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { suggest, type SuggestEntry, type Suggestion, type SuggestionKind } from "@jobccq/shared";

const KIND_LABEL: Record<SuggestionKind, string> = {
  metier: "Métier",
  entreprise: "Entreprise",
  ville: "Ville",
  categorie: "Domaine",
};

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Vocabulaire à suggérer (métiers, entreprises, villes…). */
  entries: readonly SuggestEntry[];
  /** Sélection d'une suggestion (par défaut : renseigne la valeur). */
  onSelect?: (s: Suggestion) => void;
  placeholder?: string;
  /** Icône affichée à gauche (ex. « 🔎 »). Ajuste le padding gauche. */
  icon?: ReactNode;
  className?: string;
  ariaLabel?: string;
  limit?: number;
}

/**
 * Champ de recherche avec autocomplétion : propose des métiers, entreprises et
 * villes (classement partagé `suggest`, tolérant aux fautes de frappe).
 * Navigation clavier (↑/↓, Entrée, Échap) et sélection à la souris.
 */
export function SearchAutocomplete({
  value,
  onChange,
  entries,
  onSelect,
  placeholder,
  icon,
  className,
  ariaLabel,
  limit = 8,
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suggestions = useMemo(() => suggest(value, entries, limit), [value, entries, limit]);
  const visible = open && suggestions.length > 0;

  const choose = (s: Suggestion) => {
    if (onSelect) onSelect(s);
    else onChange(s.value);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!visible) {
      if (e.key === "ArrowDown" && suggestions.length) setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (active >= 0 && active < suggestions.length) {
        e.preventDefault();
        choose(suggestions[active]!);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div className="relative">
      {icon != null && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </span>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Léger délai pour laisser passer un clic sur une option.
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={className}
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
      />
      {visible && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
          onMouseDown={(e) => {
            // Empêche le blur de l'input avant la sélection.
            e.preventDefault();
            if (blurTimer.current) clearTimeout(blurTimer.current);
          }}
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.kind}-${s.value}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(s)}
              className={
                "flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 " +
                (i === active ? "bg-brand-50 text-brand-700" : "text-slate-700")
              }
            >
              <span className="truncate">{s.label}</span>
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                {KIND_LABEL[s.kind]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
