// The 2024 golden characters on the sheet, behind the 2024 rules preview of Preferences (ORC-238, ORC-250 to ORC-252, ORC-308).

import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

async function openFighter(page: Page, level: number) {
  await page.addInitScript(() => localStorage.setItem("alchemy-dev-2024", "on"));
  await page.goto(`/dev/2024?level=${level}`);
  await expect(page.getByRole("heading", { name: "Brunhild" })).toBeVisible();
}

/** A golden character by its full name, at a level that it checks. */
async function openGolden(page: Page, name: string, level: number) {
  await page.addInitScript(() => localStorage.setItem("alchemy-dev-2024", "on"));
  await page.goto(`/dev/2024?${new URLSearchParams({ character: name, level: String(level) })}`);
}

test("without the 2024 rules preview, the page is not found", async ({ page }) => {
  await page.goto("/dev/2024");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("Preferences turns the 2024 rules preview on and links to it (ORC-308)", async ({ page }) => {
  await page.goto("/preferences");
  const experimental = page.getByRole("region", { name: "Experimental" });
  await experimental.getByRole("checkbox", { name: "2024 rules preview" }).click();
  await experimental.getByRole("link", { name: "Open the 2024 rules preview" }).click();
  await expect(page).toHaveURL(/\/dev\/2024$/);
  await expect(page.getByText("2024 rules preview", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Brunhild" })).toBeVisible();

  await page.goto("/preferences");
  await experimental.getByRole("checkbox", { name: "2024 rules preview" }).click();
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
  await expect(secondWind.getByRole("img", { name: "Second Wind uses spent: 0 of 4" })).toBeVisible();
  await expect(secondWind.getByText("Short rest (1), Long rest")).toBeVisible();
  await expect(page.getByText("Origin feat")).toBeVisible();
});

test("changes the level", async ({ page }) => {
  await openFighter(page, 20);
  await page.getByRole("link", { name: "Level 1", exact: true }).click();
  await expect(page.getByText("Fighter 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Second Wind" }).getByRole("img", { name: "Second Wind uses spent: 0 of 2" })).toBeVisible();
});

test("shows the Monk's Martial Arts on the Shortsword and the Unarmed Strike", async ({ page }) => {
  await openGolden(page, "Monk (Human Criminal, Open Hand)", 20);
  await expect(page.getByRole("heading", { name: "Mei" })).toBeVisible();
  const attacks = page.getByRole("table", { name: "Weapon attacks" });
  // Dex 7 + PB 6, and the Martial Arts die 1d12 (golden/characters/monk.ts).
  await expect(attacks.getByRole("row", { name: /^Shortsword / }).getByRole("cell")).toHaveText(["Shortsword", "Yes", "+13 to hit", "1d12+7 Piercing"]);
  await expect(attacks.getByRole("row", { name: /^Unarmed Strike / }).getByRole("cell")).toHaveText([
    "Unarmed Strike",
    "Yes",
    "+13 to hit",
    "1d12+7 Bludgeoning",
  ]);
});
