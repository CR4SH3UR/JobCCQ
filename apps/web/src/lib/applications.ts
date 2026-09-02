"use client";

import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";

/**
 * Candidatures « j'ai postulé ».
 *
 * Permet à une personne de marquer les offres où elle a envoyé son CV (crochet
 * vert), et de les retrouver sur sa page « Mes candidatures ». Même mécanique
 * que les favoris :
 * - **Anonyme / Supabase non configuré** : stockées dans le navigateur
 *   (localStorage) — aucun compte requis.
 * - **Connecté (Supabase)** : synchronisées dans la table `applications`
 *   (protégée par RLS : chacun ne voit que les siennes). À la connexion, les
 *   candidatures locales sont **fusionnées** dans le compte (rien n'est perdu).
 *
 * localStorage sert de cache immédiat → l'UI est instantanée et marche hors
 * ligne ; la synchro distante se fait en arrière-plan.
 */
const KEY = "jobccq:applications";

let cache: Set<string> | null = null;
let userId: string | null = null;
const listeners = new Set<() => void>();
const EMPTY: ReadonlySet<string> = new Set();

function read(): Set<string> {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

/** Remplace l'ensemble courant : met à jour le cache, le miroir localStorage et notifie. */
function write(next: Set<string>): void {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    /* stockage indisponible */
  }
  listeners.forEach((l) => l());
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

/** Marque/retire une offre comme « postulée » (optimiste + écriture distante si connecté). */
export function toggleApplied(id: string): void {
  const next = new Set(read());
  const adding = !next.has(id);
  adding ? next.add(id) : next.delete(id);
  write(next);
  if (userId && supabase) {
    if (adding) {
      supabase
        .from("applications")
        .upsert({ user_id: userId, job_id: id }, { onConflict: "user_id,job_id", ignoreDuplicates: true })
        .then(({ error }) => error && console.warn("candidature (ajout) non synchronisée :", error.message));
    } else {
      supabase
        .from("applications")
        .delete()
        .eq("user_id", userId)
        .eq("job_id", id)
        .then(({ error }) => error && console.warn("candidature (retrait) non synchronisée :", error.message));
    }
  }
}

/** À la connexion : fusionne les candidatures locales avec celles du compte. */
async function onLogin(uid: string): Promise<void> {
  userId = uid;
  if (!supabase) return;
  const { data, error } = await supabase.from("applications").select("job_id").eq("user_id", uid);
  if (error) {
    console.warn("Candidatures distantes illisibles (RLS/table ?) :", error.message);
    return; // on garde les candidatures locales, rien n'est perdu
  }
  const remote = new Set((data ?? []).map((r) => String((r as { job_id: string }).job_id)));
  const local = read();
  const localOnly = [...local].filter((id) => !remote.has(id));
  // Les candidatures marquées hors connexion rejoignent le compte.
  if (localOnly.length) {
    const { error: insErr } = await supabase
      .from("applications")
      .upsert(localOnly.map((job_id) => ({ user_id: uid, job_id })), {
        onConflict: "user_id,job_id",
        ignoreDuplicates: true,
      });
    if (insErr) console.warn("Fusion des candidatures locales échouée :", insErr.message);
  }
  write(new Set([...remote, ...local]));
}

function onLogout(): void {
  userId = null; // les candidatures locales (miroir) restent utilisables hors connexion
}

// Abonnement à l'état d'authentification (navigateur uniquement).
if (typeof window !== "undefined" && supabase) {
  supabase.auth.getSession().then(({ data }) => {
    if (data.session?.user) void onLogin(data.session.user.id);
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) void onLogin(session.user.id);
    else onLogout();
  });
}

/** Ensemble réactif des id de candidatures (vide côté serveur / export statique). */
export function useApplications(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** L'offre `id` est-elle marquée « postulée » ? (réactif) */
export function useHasApplied(id: string): boolean {
  return useApplications().has(id);
}
