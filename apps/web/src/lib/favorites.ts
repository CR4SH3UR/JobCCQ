"use client";

import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";

/**
 * Favoris « offres sauvegardées ».
 *
 * - **Anonyme / Supabase non configuré** : stockés dans le navigateur
 *   (localStorage) — aucun compte requis.
 * - **Connecté (Supabase)** : synchronisés dans la table `favorites` (protégée
 *   par RLS : chacun ne voit que les siens). À la connexion, les favoris
 *   anonymes déjà présents sont **fusionnés** dans le compte (rien n'est perdu).
 *
 * Dans tous les cas, localStorage sert de cache immédiat → l'UI est instantanée
 * et fonctionne hors ligne ; la synchro distante se fait en arrière-plan.
 */
const KEY = "jobccq:favorites";

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

/** Ajoute/retire une offre des favoris (optimiste + écriture distante si connecté). */
export function toggleFavorite(id: string): void {
  const next = new Set(read());
  const adding = !next.has(id);
  adding ? next.add(id) : next.delete(id);
  write(next);
  if (userId && supabase) {
    if (adding) {
      supabase
        .from("favorites")
        .upsert({ user_id: userId, job_id: id }, { onConflict: "user_id,job_id", ignoreDuplicates: true })
        .then(({ error }) => error && console.warn("favori (ajout) non synchronisé :", error.message));
    } else {
      supabase
        .from("favorites")
        .delete()
        .eq("user_id", userId)
        .eq("job_id", id)
        .then(({ error }) => error && console.warn("favori (retrait) non synchronisé :", error.message));
    }
  }
}

/** À la connexion : fusionne les favoris anonymes avec ceux du compte. */
async function onLogin(uid: string): Promise<void> {
  userId = uid;
  if (!supabase) return;
  const { data, error } = await supabase.from("favorites").select("job_id").eq("user_id", uid);
  if (error) {
    console.warn("Favoris distants illisibles (RLS/table ?) :", error.message);
    return; // on garde les favoris locaux, rien n'est perdu
  }
  const remote = new Set((data ?? []).map((r) => String((r as { job_id: string }).job_id)));
  const local = read();
  const localOnly = [...local].filter((id) => !remote.has(id));
  // Les favoris ajoutés hors connexion rejoignent le compte.
  if (localOnly.length) {
    const { error: insErr } = await supabase
      .from("favorites")
      .upsert(localOnly.map((job_id) => ({ user_id: uid, job_id })), {
        onConflict: "user_id,job_id",
        ignoreDuplicates: true,
      });
    if (insErr) console.warn("Fusion des favoris locaux échouée :", insErr.message);
  }
  write(new Set([...remote, ...local]));
}

function onLogout(): void {
  userId = null; // les favoris locaux (miroir) restent utilisables hors connexion
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

/** Ensemble réactif des id favoris (vide côté serveur / export statique). */
export function useFavorites(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** L'offre `id` est-elle en favori ? (réactif) */
export function useIsFavorite(id: string): boolean {
  return useFavorites().has(id);
}
