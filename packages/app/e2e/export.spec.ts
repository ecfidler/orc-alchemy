import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");

async function importFixture(page: Page, name: string, heading: string) {
  await page.goto("/");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, `${name}.strict.json`));
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
}

test("a character exports as a dmv-character file that imports back", async ({ page }) => {
  await importFixture(page, "fighter-1", "Brannor Ironfist");
  const firstUrl = page.url();

  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export this character" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("Brannor Ironfist.json");
  const file = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(file).toMatchObject({ format: "dmv-character", version: 1, rules: "2014", name: "Brannor Ironfist" });

  await page.goto("/");
  await page.getByLabel("Import character file").setInputFiles(await download.path());
  await expect(page.getByRole("heading", { level: 1, name: "Brannor Ironfist" })).toBeVisible();
  await expect(page.getByLabel("Armor Class", { exact: true })).toHaveText("19");
  expect(page.url()).not.toBe(firstUrl);
});

test("export everything downloads a dmv-export bundle that imports back", async ({ page }) => {
  await importFixture(page, "fighter-1", "Brannor Ironfist");
  await importFixture(page, "wizard-5", "Fimble Nackle");

  await page.goto("/");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export everything" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("dmv-export.json");
  const bundle = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(bundle).toMatchObject({ format: "dmv-export", version: 1, magicItems: [] });
  expect(bundle.characters).toHaveLength(2);

  await page.getByLabel("Import character file").setInputFiles(await download.path());
  await expect(page.getByRole("heading", { name: "Imported 2 characters" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Brannor Ironfist" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fimble Nackle" })).toBeVisible();
});

test("export everything with nothing stored says so", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Export everything" }).click();
  await expect(page.getByRole("alert")).toHaveText("There are no characters to export");
});
