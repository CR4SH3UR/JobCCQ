"use client";

import { useSyncExternalStore } from "react";
import { SPONSOR_CONFIG, readConfig, type SponsorConfig } from "./sponsors.js";
import { activePinnedJobIds } from "./sponsors-parse.js";

/**
 * Config commandites **live** : le bundle est le repli ; on relit GitHub
 * `main` pour que vedettes / bannières apparaissent dès la publication admin,
 * sans attendre le redéploiement.
 */

const listeners = new Set<() => void>();
let cache: SponsorConfig = SPONSOR_CONFIG;
let hydrated = false;

function emit(): void {
  listeners.forEach((l) => l());
}

export function getLiveSponsorConfig(): SponsorConfig {
  return cache;
}

export function setLiveSponsorConfig(next: SponsorConfig): void {
  cache = next;
  emit();
}

export function featuredSet(cfg: SponsorConfig = cache): ReadonlySet<string> {
  return new Set(cfg.featured);
}

export function pinnedIdList(cfg: SponsorConfig = cache, now = new Date()): readonly string[] {
  return activePinnedJobIds(cfg.pinned, now);
}

export function employerIsSponsored(sourceId?: string | null, cfg: SponsorConfig = cache): boolean {
  return !!sourceId && featuredSet(cfg).has(sourceId);
}

export function jobIsPinned(jobId?: string | null, cfg: SponsorConfig = cache): boolean {
  return !!jobId && pinnedIdList(cfg).includes(jobId);
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

export function sponsorsRawUrl(): string {
  const { owner, repo } = ghRepo();
  return `https://raw.githubusercontent.com/${owner}/${repo}/main/apps/web/src/data/sponsors.json?t=${Date.now()}`;
}

/** Relit `sponsors.json` sur main. Idempotent. */
export async function hydrateSponsors(): Promise<SponsorConfig> {
  if (typeof fetch !== "function") return cache;
  try {
    const r = await fetch(sponsorsRawUrl(), { cache: "no-store" });
    if (!r.ok) return cache;
    const next = readConfig(await r.json());
    cache = next;
    hydrated = true;
    emit();
    return next;
  } catch {
    return cache;
  }
}

export function sponsorsHydrated(): boolean {
  return hydrated;
}

export function useSponsorConfig(): SponsorConfig {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => cache,
    () => SPONSOR_CONFIG,
  );
}
