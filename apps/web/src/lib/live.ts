"use client";

import { useEffect } from "react";

/**
 * Mécanisme de rafraîchissement "live" des offres.
 *
 * - En mode navigateur, un `BroadcastChannel` porte le nom `jobccq-jobs`.
 *   Le panneau admin y poste un message `refresh` après chaque modification
 *   d'offre ; les pages publiques (accueil, liste d'emplois) écoutent et
 *   relancent leur requête immédiatement.
 * - Un polling toutes les 30 s sert de filet de sécurité (autres onglets,
 *   autres appareils, BroadcastChannel indisponible).
 */

export const JOBS_CHANNEL = "jobccq-jobs";

export const LIVE_POLL_INTERVAL_MS = Number(
  process.env.NEXT_PUBLIC_LIVE_POLL_INTERVAL ?? 30_000,
);

export type LiveMessage = { type: "refresh" };

export function notifyJobsChanged() {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  try {
    const ch = new BroadcastChannel(JOBS_CHANNEL);
    ch.postMessage({ type: "refresh" } as LiveMessage);
    ch.close();
  } catch {
    /* ignore */
  }
}

export function useLiveRefresh(onRefresh: () => void) {
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(JOBS_CHANNEL);
      ch.onmessage = (ev: MessageEvent<LiveMessage>) => {
        if (ev.data?.type === "refresh") onRefresh();
      };
    } catch {
      /* ignore */
    }
    return () => {
      try {
        ch?.close();
      } catch {
        /* ignore */
      }
    };
  }, [onRefresh]);
}

/**
 * Hook combinant polling + BroadcastChannel : appelle `onRefresh` toutes les
 * `intervalMs` millisecondes, et immédiatement quand une modification admin est
 * publiée sur le canal.
 */
export function useLivePoll(onRefresh: () => void, intervalMs = LIVE_POLL_INTERVAL_MS) {
  useLiveRefresh(onRefresh);
  useEffect(() => {
    if (intervalMs <= 0) return;
    const id = setInterval(onRefresh, intervalMs);
    return () => clearInterval(id);
  }, [onRefresh, intervalMs]);
}
