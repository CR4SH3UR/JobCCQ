import { test, expect } from "@playwright/test";

test("favoris : ajout depuis la liste, puis présence dans /favoris", async ({ page }) => {
  await page.goto("/emplois/");
  const firstCard = page.locator("article.card").first();
  await expect(firstCard).toBeVisible();
  const title = (await firstCard.locator("h3 a").first().textContent())?.trim() ?? "";

  // Bouton cœur de la carte (aria-label « Ajouter aux favoris » / « Retirer… »).
  const fav = firstCard.getByRole("button", { name: /favoris/i });
  await expect(fav).toHaveAttribute("aria-pressed", "false");
  await fav.click();
  await expect(fav).toHaveAttribute("aria-pressed", "true");

  // Le favori est persistant (localStorage) et listé dans /favoris.
  await page.goto("/favoris/");
  if (title) {
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible();
  }
});
