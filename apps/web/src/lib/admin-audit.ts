"use client";

import { useSyncExternalStore } from "react";

/**
 * Journal d'audit des actions admin — « qui a modifié quoi, quand ».
 *
 * Stocké **dans ce navigateur** (localStorage) : la console d'admin est un
 * outil client (modes API/Turso/statique) sans table d'audit côté serveur ; ce
 * journal trace donc les actions faites depuis ce poste. « Qui » = l'adresse du
 * compte connecté quand elle est disponible. À compléter par une table partagée
 * (Turso/Supabase) si un audit multi-postes devient nécessaire.
 */
export type AuditAction =
  | "edit"
  | "scrape"
  | "scrape-force"
  | "scrape-all"
  | "purge"
  | "delete"
  | "merge"
  | "rename"
  | "publish"
  | "redeploy";

export interface AuditEntry {
  id: string;
  ts: number;
  actor?: string;
  action: AuditAction;
  targetId?: string;
  targetName?: string;
  detail?: string;
}

const KEY = "jobccq:admin-audit";
const MAX = 300;

let cache: AuditEntry[] | null = null;
let actor: string | undefined;
const listeners = new Set<() => void>();
const EMPTY: AuditEntry[] = [];

function read(): AuditEntry[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as AuditEntry[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function persist(list: AuditEntry[]): void {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* stockage indisponible */
  }
  listeners.forEach((l) => l());
}

/** Définit « qui » agit (adresse du compte admin connecté). */
export function setAuditActor(email?: string): void {
  actor = email;
}

/** Enregistre une action dans le journal (best-effort ; jamais bloquant). */
export function logAudit(
  action: AuditAction,
  info: { targetId?: string; targetName?: string; detail?: string } = {},
): void {
  if (typeof window === "undefined") return;
  const entry: AuditEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    actor,
    action,
    ...info,
  };
  persist([entry, ...read()].slice(0, MAX));
}

/** Vide le journal (ce navigateur). */
export function clearAudit(): void {
  persist([]);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Journal réactif (le plus récent d'abord). */
export function useAuditLog(): AuditEntry[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
