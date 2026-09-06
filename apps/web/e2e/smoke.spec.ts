import { test, expect } from "@playwright/test";

test("accueil : navigation principale visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Emplois" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Marché" })).toBeVisible();
});

test("emplois : liste d'offres + recherche encodée dans l'URL", async ({ page }) => {
  await page.goto("/emplois/");
  const search = page.getByPlaceholder(/poste, m[ée]tier/i);
  await expect(search).toBeVisible();
  // Au moins une offre est listée.
  await expect(page.locator("article.card h3 a").first()).toBeVisible();
  // La recherche est partageable : le mot-clé se retrouve dans l'URL (idée #8).
  await search.fill("manoeuvre");
  await expect(page).toHaveURL(/[?&]q=manoeuvre/i, { timeout: 10_000 });
});

test("marché : dashboard public accessible", async ({ page }) => {
  await page.goto("/marche/");
  await expect(
    page.getByRole("heading", { name: /march[ée] de la construction/i }),
  ).toBeVisible();
  await expect(page.getByText("Offres ouvertes", { exact: true })).toBeVisible();
});

test("détail : ouverture d'une offre depuis la liste", async ({ page }) => {
  await page.goto("/emplois/");
  const first = page.locator("article.card h3 a").first();
  await expect(first).toBeVisible();
  const title = (await first.textContent())?.trim() ?? "";
  await first.click();
  await expect(page).toHaveURL(/\/emplois\/[^/]+\/?$/);
  // Le h1 de la fiche porte l'intitulé (les cartes « offres similaires » plus bas
  // peuvent répéter le titre → on cible explicitement le titre de niveau 1).
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toBeVisible();
  if (title) await expect(h1).toContainText(title);
});
