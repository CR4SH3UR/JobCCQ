"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Recherches enregistrées — combinaisons de filtres nommées, stockées **dans ce
 * navigateur** (localStorage). Aucune connexion requise ; fonctionne dans tous
 * les modes (y compris le site 100 % statique). Une recherche = un nom + la
 * query string des filtres (voir `search-url.ts`). C'est la brique de base des
 * alertes : on peut rejouer une recherche en un clic, ou en faire une alerte.
 */
export interface SavedSearch {
  id: string;
  name: string;
  /** Query string des filtres (« q=…&regions=… »). */
  query: string;
  createdAt: number;
}

const KEY = "jobccq:saved-searches";

function read(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedSearch[]) : [];
  } catch {
    return [];
  }
}

function write(list: SavedSearch[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* stockage indisponible (navigation privée…) : on ignore */
  }
}

/**
 * Hook de gestion des recherches enregistrées : liste + ajout/suppression,
 * synchronisé entre onglets via l'événement `storage`.
 */
export function useSavedSearches() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);

  useEffect(() => {
    setSearches(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setSearches(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const save = useCallback((name: string, query: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSearches((prev) => {
      // Un même nom écrase l'entrée précédente (mise à jour).
      const rest = prev.filter((s) => s.name.toLowerCase() !== trimmed.toLowerCase());
      const next = [
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: trimmed, query, createdAt: Date.now() },
        ...rest,
      ].slice(0, 30); // garde-fou : 30 recherches max
      write(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setSearches((prev) => {
      const next = prev.filter((s) => s.id !== id);
      write(next);
      return next;
    });
  }, []);

  return { searches, save, remove };
}
