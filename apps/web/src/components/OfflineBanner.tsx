"use client";

import { useSyncExternalStore } from "react";
import { getOfflineMeta, subscribeOfflineMeta } from "@/lib/offline-snapshot";

/** Bannière si l'instantané des offres vient du cache local (hors ligne). */
export function OfflineBanner() {
  const meta = useSyncExternalStore(subscribeOfflineMeta, getOfflineMeta, getOfflineMeta);
  if (!meta.fromCache) return null;

  let when = "";
  if (meta.savedAt) {
    const t = Date.parse(meta.savedAt);
    if (!Number.isNaN(t)) {
      when = ` (${new Date(t).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" })})`;
    }
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
      Hors ligne — offres en cache{when}. Reconnecte-toi pour la dernière version.
    </div>
  );
}
