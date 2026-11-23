// The 2024 golden Fighter on the sheet, behind the developer flag (ORC-238).

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

async function openFighter(page: Page, level: number) {
  await page.addInitScript(() => localStorage.setItem("alchemy-dev-2024", "on"));
  await page.goto(`/dev/2024?level=${level}`);
  await expect(page.getByRole("heading", { name: "Brunhild" })).toBeVisible();
}

test("without the developer flag, the page is not found", async ({ page }) => {
  await page.goto("/dev/2024");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("a 2014 sheet loads no 2024 code", async ({ page }) => {
  // Each script the page loads, as text. A text of the 2024 pack marks the 2024 engine chunk.
  const scripts: Promise<string>[] = [];
  page.on("response", (response) => {
    if (response.url().endsWith(".js")) scripts.push(response.text());
  });
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(import.meta.dirname, "../../../fixtures/characters/fighter-1.strict.json"));
  await expect(page.getByRole("heading", { level: 1, name: "Brannor Ironfist" })).toBeVisible();
  const texts = await Promise.all(scripts);
  expect(texts.length).toBeGreaterThan(0);
  expect(texts.filter((text) => text.includes("boon-of-irresistible-offense"))).toEqual([]);
});

test("shows the golden Fighter at level 20 with its Weapon Mastery properties and its Second Wind uses", async ({ page }) => {
  await openFighter(page, 20);
  await expect(page.getByText("Fighter 20")).toBeVisible();
  const attacks = page.getByRole("table", { name: "Weapon attacks" });
  await expect(attacks.getByRole("row", { name: /^Greatsword / }).getByRole("cell")).toHaveText(["Greatsword Graze", "Yes", "+11 to hit", "2d6+5 Slashing"]);
  await expect(attacks.getByRole("row", { name: /^Longbow / }).getByRole("cell")).toHaveText(["Longbow Slow", "Yes", "+10 to hit", "1d8+2 Piercing"]);
  // Second Wind: 4 uses; one back on a Short Rest, all on a Long Rest.
  const secondWind = page.getByRole("group", { name: "Second Wind" });
  await expect(secondWind.getByRole("group", { name: "4 uses, 4 left" })).toBeVisible();
  await expect(secondWind.getByText("Short rest (1), Long rest")).toBeVisible();
  await expect(page.getByText("Origin feat")).toBeVisible();
});

test("changes the level", async ({ page }) => {
  await openFighter(page, 20);
  await page.getByRole("link", { name: "Level 1", exact: true }).click();
  await expect(page.getByText("Fighter 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Second Wind" }).getByRole("group", { name: "2 uses, 2 left" })).toBeVisible();
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bun run e2e -- sheet-2024.spec.ts
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`orc-238 the 2024 Fighter at level 20, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      await page.setViewportSize({ width: 1280, height: 900 });
      await openFighter(page, 20);
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: join(dir, `orc-238-fighter-20-${theme}.png`), fullPage: true });
    });
  }
});
