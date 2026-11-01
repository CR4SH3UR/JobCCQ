"use client";

import { useSyncExternalStore } from "react";
import { BANNER_CONFIG, readBannerConfig, type BannerConfig } from "./banner.js";

/**
 * Config du bandeau **live** : le bundle est le repli ; on relit GitHub `main`
 * pour que les changements apparaissent dès la publication admin, sans attendre
 * le redéploiement. Même mécanisme que `sponsors-live.ts`.
 */

const listeners = new Set<() => void>();
let cache: BannerConfig = BANNER_CONFIG;

function emit(): void {
  listeners.forEach((l) => l());
}

export function setLiveBannerConfig(next: BannerConfig): void {
  cache = next;
  emit();
}

function ghRepo(): { owner: string; repo: string } {
  try {
    const host = location.hostname.split(".")[0];
    const seg = location.pathname.split("/").filter(Boolean)[0];
    if (location.hostname.endsWith("github.io") && host && seg) return { owner: host, repo: seg };
  } catch {
    /* SSR / hors navigateur */
  }
  return { owner: "CR4SH3UR", repo: "JobCCQ" };
}

export function bannerRawUrl(): string {
  const { owner, repo } = ghRepo();
  return `https://raw.githubusercontent.com/${owner}/${repo}/main/apps/web/src/data/banner.json?t=${Date.now()}`;
}

/** Relit `banner.json` sur main. Idempotent. */
export async function hydrateBanner(): Promise<BannerConfig> {
  if (typeof fetch !== "function") return cache;
  try {
    const r = await fetch(bannerRawUrl(), { cache: "no-store" });
    if (!r.ok) return cache;
    const next = readBannerConfig(await r.json());
    cache = next;
    emit();
    return next;
  } catch {
    return cache;
  }
}

export function useBannerConfig(): BannerConfig {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => cache,
    () => BANNER_CONFIG,
  );
}
