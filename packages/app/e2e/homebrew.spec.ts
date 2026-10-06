import { join } from "node:path";
import { expect, test } from "@playwright/test";

const orcbrewDir = join(import.meta.dirname, "../../../fixtures/orcbrew");

test("a chosen homebrew pack is listed until it is removed", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Load homebrew file").setInputFiles(join(orcbrewDir, "warlock-test-content.orcbrew"));

  const pack = page.getByRole("listitem", { name: "warlock-test-content" });
  await expect(pack).toBeVisible();
  await expect(page.getByRole("region", { name: "Last homebrew import" })).toContainText("Import successful");

  await pack.getByRole("button", { name: "Remove warlock-test-content" }).click();
  await expect(pack).toHaveCount(0);
});

test("a loaded pack and its enabled flag survive a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Load homebrew file").setInputFiles(join(orcbrewDir, "warlock-test-content.orcbrew"));
  const enabled = page.getByRole("listitem", { name: "warlock-test-content" }).getByRole("checkbox", { name: "warlock-test-content" });
  await expect(enabled).toBeChecked();

  await page.reload();
  await expect(enabled).toBeChecked();
  // The checkbox changes once the flag is stored, so check it after the click.
  await enabled.click();
  await expect(enabled).not.toBeChecked();

  await page.reload();
  await expect(enabled).not.toBeChecked();
});
