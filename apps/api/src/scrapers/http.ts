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

/** Construit l'URL proxifiée pour une cible (sans tester l'allowlist d'hôtes). */
function proxyUrlFor(rawUrl: string): string | null {
  let tmpl = env.SCRAPE_PROXY_URL;
  if (!tmpl) return null;
  // Tolère une URL de proxy sans schéma (ex. « xxx.workers.dev ») : on préfixe
  // https:// sinon `new URL(tmpl)` lève « Invalid URL » et le scrape échoue.
  if (!/^https?:\/\//i.test(tmpl)) tmpl = `https://${tmpl}`;
  const token = env.SCRAPE_PROXY_TOKEN;
  if (tmpl.includes("{url}")) {
    return tmpl
      .replace(/\{url\}/g, encodeURIComponent(rawUrl))
      .replace(/\{token\}/g, encodeURIComponent(token));
  }
  try {
    const u = new URL(tmpl);
    u.searchParams.set("url", rawUrl);
    if (token) u.searchParams.set("token", token);
    return u.toString();
  } catch {
    return null;
  }
}

/** L'hôte de `rawUrl` est-il dans l'allowlist proxy (SCRAPE_PROXY_HOSTS) ? */
function hostInProxyList(rawUrl: string): boolean {
  let host: string;
  try {
    host = new URL(rawUrl).hostname;
  } catch {
    return false;
  }
  const hosts = env.SCRAPE_PROXY_HOSTS.split(",").map((s) => s.trim()).filter(Boolean);
  if (!hosts.length) return true; // vide = tous
  if (hosts.includes("*")) return true; // joker = tous
  return hosts.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * Réécrit une URL cible pour passer par le proxy sortant si configuré et si
 * l'hôte est concerné (SCRAPE_PROXY_HOSTS ; « * » ou vide = tous). Retourne
 * `null` = pas de proxy. Contourne les blocages par IP (ex. Jobillico → 403,
 * ou des sites qui n'acceptent pas les IP de centre de données de CI).
 * `force` ignore l'allowlist : utilisé en **repli** quand la requête directe a
 * échoué (le proxy sert alors de secours pour n'importe quel hôte bloqué).
 */
function proxied(rawUrl: string, force = false): string | null {
  if (!env.SCRAPE_PROXY_URL) return null;
  if (!force && !hostInProxyList(rawUrl)) return null;
  return proxyUrlFor(rawUrl);
}

export interface FetchOptions {
  retries?: number;
  timeoutMs?: number;
  /** User-Agent spécifique (certains ATS bloquent les UA « bot » identifiables). */
  userAgent?: string;
}

/** Une tentative complète (avec retries/backoff) contre une URL donnée. */
async function fetchWithRetry(
  target: string,
  origUrl: string,
  retries: number,
  timeoutMs: number,
  userAgent: string,
): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(target, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": userAgent,
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
        throw Object.assign(new Error(`HTTP ${res.status} sur ${origUrl}`), { fatal: true });
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
  throw new Error(`Échec de récupération : ${origUrl}`);
}

/**
 * Récupère le HTML d'une URL de manière « responsable » :
 * User-Agent identifiable, en-têtes FR, throttling, timeout et retry
 * avec backoff exponentiel sur 429 / 5xx / erreurs réseau.
 *
 * Si la requête **directe** échoue et qu'un proxy est configuré (sans que
 * l'hôte soit déjà routé via le proxy), on retente **une fois** via le proxy :
 * beaucoup de sites bloquent les IP de centre de données de GitHub Actions
 * (connexion coupée / page vide), mais pas l'IP du proxy. Ce repli automatique
 * rattrape n'importe quel hôte bloqué sans devoir l'inscrire au préalable.
 */
export async function fetchHtml(url: string, opts: FetchOptions = {}): Promise<string> {
  const { retries = 2, timeoutMs = 20_000, userAgent = env.USER_AGENT } = opts;

  const viaProxy = proxied(url); // non-null si l'hôte est déjà routé via le proxy
  const target = viaProxy ?? url;

  try {
    return await fetchWithRetry(target, url, retries, timeoutMs, userAgent);
  } catch (err) {
    // Repli proxy : uniquement si on n'y est pas déjà passé et qu'un proxy existe.
    if (!viaProxy) {
      const forced = proxied(url, true);
      if (forced) {
        return await fetchWithRetry(forced, url, retries, timeoutMs, userAgent);
      }
    }
    throw err;
  }
}

/** Contexte de scraping par défaut (réseau réel). */
export function createHttpContext(log: (m: string) => void = () => {}): ScrapeContext {
  return { fetchHtml: (url, opts) => fetchHtml(url, opts), log };
}
