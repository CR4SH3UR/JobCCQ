import { defineConfig, devices } from "@playwright/test";

/**
 * Tests E2E du site (#114) : recherche, filtres, fiche d'offre, favoris, marché.
 *
 * Le serveur de test est `next dev` (mode non-statique, comme en local) ; les
 * offres viennent de `public/data/jobs.json`.
 *
 * Navigateur : en CI, `npx playwright install chromium` fournit le binaire.
 * Dans l'environnement Claude Code, Chromium est déjà présent — on pointe son
 * binaire via `PW_CHROMIUM_PATH` (ex.
 * `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) pour éviter tout
 * téléchargement.
 */
const PORT = Number(process.env.PW_PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Mode statique : le site lit l'instantané `public/data/jobs.json` au lieu de
    // taper l'API Fastify (absente pendant les tests) → des offres réelles à l'écran.
    env: { NEXT_PUBLIC_STATIC_DATA: "1" },
  },
});
