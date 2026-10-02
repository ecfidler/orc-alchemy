import { expect, test } from "@playwright/test";

test("the shell loads and routes client-side", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Characters" })).toBeVisible();

  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  await page.getByRole("link", { name: "Back to characters" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Characters" })).toBeVisible();
});
