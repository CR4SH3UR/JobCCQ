import { env } from "../env.js";
import type { ScrapeContext } from "./types.js";

let lastRequestAt = 0;

/** Attente polie pour ne pas marteler une source. */
async function throttle(minGapMs = env.SCRAPE_DELAY_MS): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, lastRequestAt + minGapMs - now);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FetchOptions {
  retries?: number;
  timeoutMs?: number;
}

/**
 * Récupère le HTML d'une URL de manière « responsable » :
 * User-Agent identifiable, en-têtes FR, throttling, timeout et retry
 * avec backoff exponentiel sur 429 / 5xx / erreurs réseau.
 */
export async function fetchHtml(url: string, opts: FetchOptions = {}): Promise<string> {
  const { retries = 2, timeoutMs = 20_000 } = opts;

  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": env.USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.6",
        },
      });
      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        // 4xx définitif : inutile de réessayer.
        throw Object.assign(new Error(`HTTP ${res.status} sur ${url}`), { fatal: true });
      }
      return await res.text();
    } catch (err) {
      clearTimeout(timer);
      const fatal = (err as { fatal?: boolean }).fatal;
      if (fatal || attempt === retries) throw err;
      const backoff = 1000 * 2 ** attempt;
      await sleep(backoff);
    }
  }
  throw new Error(`Échec de récupération : ${url}`);
}

/** Contexte de scraping par défaut (réseau réel). */
export function createHttpContext(log: (m: string) => void = () => {}): ScrapeContext {
  return { fetchHtml: (url) => fetchHtml(url), log };
}
