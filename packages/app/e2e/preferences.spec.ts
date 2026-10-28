import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pickOption } from "@orc-alchemy/ui/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");
const stored = (page: Page) => page.evaluate(() => localStorage.getItem("theme"));

test("the orange tab opens Preferences, and Dark applies at once, here and in another tab", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Preferences" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Preferences" })).toBeVisible();
  const theme = page.getByRole("combobox", { name: "Theme" });
  await expect(theme).toHaveText("Match System");

  const other = await context.newPage();
  await other.emulateMedia({ colorScheme: "light" });
  await other.goto("/characters");

  await pickOption(theme, "Dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await stored(page)).toBe("dark");
  await expect(other.locator("html")).toHaveAttribute("data-theme", "dark");

  await pickOption(theme, "Match System");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  expect(await stored(page)).toBeNull();
  await expect(other.locator("html")).not.toHaveAttribute("data-theme");
});

test("export everything has no preferences in it", async ({ page }) => {
  await page.goto("/preferences");
  await pickOption(page.getByRole("combobox", { name: "Theme" }), "Dark");
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, "fighter-1.strict.json"));
  await expect(page.getByRole("heading", { level: 1, name: "Brannor Ironfist" })).toBeVisible();

  await page.goto("/characters");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export everything" }).click();
  const text = readFileSync(await (await downloading).path(), "utf8");
  expect(JSON.parse(text).characters).toHaveLength(1);
  expect(text).not.toMatch(/theme|preference/i);
});
