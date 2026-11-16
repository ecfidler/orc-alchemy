import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");

async function importFixture(page: Page, name: string, heading: string) {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, `${name}.strict.json`));
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
}

test("a character exports as a dmv-character file that imports back", async ({ page }) => {
  await importFixture(page, "fighter-1", "Brannor Ironfist");
  const firstUrl = page.url();

  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("Brannor Ironfist.json");
  const file = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(file).toMatchObject({ format: "dmv-character", version: 2, rules: "2014", name: "Brannor Ironfist" });
  expect(file).not.toHaveProperty("custom");

  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(await download.path());
  await expect(page.getByRole("heading", { level: 1, name: "Brannor Ironfist" })).toBeVisible();
  await expect(page.getByLabel("Armor Class", { exact: true })).toHaveText("19");
  expect(page.url()).not.toBe(firstUrl);
});

test("export everything downloads a dmv-export bundle that imports back", async ({ page }) => {
  await importFixture(page, "fighter-1", "Brannor Ironfist");
  await importFixture(page, "wizard-5", "Fimble Nackle");

  await page.goto("/characters");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export everything" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("dmv-export.json");
  const bundle = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(bundle).toMatchObject({ format: "dmv-export", version: 2, magicItems: [] });
  expect(bundle.characters).toHaveLength(2);

  await page.goto("/import");
  await page.getByLabel("Import dmv-export bundle").setInputFiles(await download.path());
  await expect(page.getByRole("heading", { name: "Imported 2 characters" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Brannor Ironfist", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fimble Nackle", exact: true })).toBeVisible();
});

test("export everything with nothing stored says so", async ({ page }) => {
  await page.goto("/characters");
  await page.getByRole("button", { name: "Export everything" }).click();
  await expect(page.getByRole("alert")).toHaveText("There are no characters or homebrew to export");
});

/** Imports fighter-20 and gives him a custom copy of his feat Grappler in the builder, then goes back to his sheet and saves. */
async function customizeGrappler(page: Page) {
  await importFixture(page, "fighter-20", "Ser Aldric");
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Steps" })
    .getByRole("button", { name: /^Feats/ })
    .click();
  await page.getByRole("button", { name: "Customize Grappler" }).click();
  const dialog = page.getByRole("dialog", { name: "Customize Grappler" });
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("link", { name: "Done", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ser Aldric" })).toBeVisible();
  // Saves now, so that a page load does not leave the change in its draft.
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeHidden();
}

test("a character with a custom feat exports as version 2 with no warning, and imports back with the feat", async ({ page }) => {
  await customizeGrappler(page);

  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloading;
  await expect(page.getByRole("note")).toHaveCount(0);
  const file = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(file).toMatchObject({
    format: "dmv-character",
    version: 2,
    custom: { "~:orcpub.dnd.e5/feats": { "~:grappler-custom": { "~:name": "Grappler (Custom)" } } },
  });

  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(await download.path());
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Ser Aldric" })).toBeVisible();
  await expect(page.getByText("Grappler (Custom)").first()).toBeVisible();
  await expect(page.getByRole("note")).toHaveCount(0);
});

test("export everything of a character with custom content shows no warning, and the bundle imports it back", async ({ page }) => {
  await customizeGrappler(page);
  await importFixture(page, "fighter-1", "Brannor Ironfist");

  await page.goto("/characters");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export everything" }).click();
  const download = await downloading;
  await expect(page.getByRole("note")).toHaveCount(0);
  const bundle = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(bundle.characters.map((c: { custom?: object }) => c.custom !== undefined).sort()).toEqual([false, true]);

  await page.goto("/import");
  await page.getByLabel("Import dmv-export bundle").setInputFiles(await download.path());
  await expect(page.getByRole("heading", { name: "Imported 2 characters" })).toBeVisible();
  await page.getByRole("button", { name: "Ser Aldric", exact: true }).click();
  await expect(page.getByText("Grappler (Custom)").first()).toBeVisible();
});
