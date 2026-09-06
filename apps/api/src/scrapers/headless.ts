import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";

/**
 * Rendu headless optionnel (Playwright) pour les pages protégées (Cloudflare).
 * Playwright n'est **pas** une dépendance du paquet : on l'importe dynamiquement.
 *   npm i -D playwright && npx playwright install chromium
 */
export async function fetchRenderedHtml(url: string, log: (m: string) => void): Promise<string> {
  let pw: {
    chromium: {
      launch: (o: { headless: boolean }) => Promise<{
        newPage: () => Promise<{
          goto: (u: string, o: { waitUntil: string; timeout: number }) => Promise<unknown>;
          content: () => Promise<string>;
        }>;
        close: () => Promise<void>;
      }>;
    };
  };
  try {
    // Playwright est optionnel (pas dans package.json) — import dynamique.
    // @ts-expect-error module optionnel, pas dans package.json
    pw = (await import("playwright")) as typeof pw;
  } catch {
    throw new Error(
      "Playwright n'est pas installé. `npm i -D playwright` puis `npx playwright install chromium`.",
    );
  }
  log(`headless : ${url}`);
  const browser = await pw.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    return await page.content();
  } finally {
    await browser.close();
  }
}

/** Scraper « headless » : fetch rendu puis parseur HTML générique fourni. */
export function makeHeadlessScraper(opts: {
  id: string;
  company: string;
  careersUrl: string;
  parseList: (html: string, baseUrl: string) => RawJob[];
}): Scraper {
  return {
    id: opts.id,
    parseList: opts.parseList,
    async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
      const html = await fetchRenderedHtml(opts.careersUrl, ctx.log);
      return opts.parseList(html, opts.careersUrl);
    },
  };
}
