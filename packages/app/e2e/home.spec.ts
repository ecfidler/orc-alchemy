import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");

async function importCharacters(page: Page, names: string[]) {
  await page.goto("/import");
  await page.getByLabel("Import dmv-export bundle").setInputFiles({
    name: "dmv-export.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "dmv-export",
        version: 1,
        characters: names.map((name) => JSON.parse(readFileSync(join(charactersDir, `${name}.strict.json`), "utf8"))),
      }),
    ),
  });
  await expect(page.getByRole("heading", { name: `Imported ${names.length} characters` })).toBeVisible();
}

test("/ is Home with no tab current, and the Characters tab opens the list", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Alchemy 5e" })).toBeVisible();
  await expect(page.getByText("Characters you make or import show here.")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" }).locator('[aria-current="page"]')).toHaveCount(0);

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Characters" }).click();
  await expect(page).toHaveURL(/\/characters$/);
  await expect(page.getByText("No characters yet. Import a character file to add one.")).toBeVisible();
});

test("a returning user sees recent characters on Home, and the stain covers no control", async ({ page }) => {
  await importCharacters(page, ["fighter-1", "wizard-5", "fighter-3-wizard-2", "barbarian-5"]);
  await page.getByRole("link", { name: "Alchemy 5e" }).click();
  await expect(page.getByRole("list", { name: "Recent characters" }).getByRole("listitem")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "All characters (4)" })).toHaveAttribute("href", "/characters");

  await expect(page.getByTestId("mug-stain")).toBeVisible();
  for (const width of [1100, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const controls = page.getByRole("main").locator("a, button");
    for (const control of await controls.all()) {
      await control.scrollIntoViewIfNeeded();
      // The element at the control's centre is the control or inside it, never the stain.
      expect(
        await control.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
        }),
      ).toBe(true);
    }
  }
});
