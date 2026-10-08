import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");

test("an imported character appears in the list and opens its sheet", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No characters yet. Import a character file to add one.")).toBeVisible();
  await page.getByRole("link", { name: "Import homebrew and characters" }).click();
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, "fighter-3-wizard-2.strict.json"));
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  const sheetUrl = page.url();

  await page.getByRole("link", { name: "Alchemy 5e" }).click();
  const corvin = page.getByRole("listitem", { name: "Corvin Half-Elven" });
  await expect(corvin).toContainText("Half-Elf · Fighter 3 / Wizard 2");

  await corvin.getByRole("link", { name: "Corvin Half-Elven" }).click();
  await expect(page).toHaveURL(sheetUrl);
  await expect(page.getByRole("heading", { level: 1, name: "Corvin Half-Elven" })).toBeVisible();
});

test("a bundle's characters appear in the list", async ({ page }) => {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles({
    name: "dmv-export.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "dmv-export",
        version: 1,
        characters: ["fighter-1", "wizard-5"].map((name) => JSON.parse(readFileSync(join(charactersDir, `${name}.strict.json`), "utf8"))),
      }),
    ),
  });
  await expect(page.getByRole("heading", { name: "Imported 2 characters" })).toBeVisible();

  await page.getByRole("link", { name: "Alchemy 5e" }).click();
  await expect(page.getByRole("list", { name: "Characters" }).getByRole("listitem")).toHaveText([/Brannor Ironfist/, /Fimble Nackle/]);
});

test("a character exports from the list", async ({ page }) => {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, "wizard-5.strict.json"));
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await page.getByRole("link", { name: "Alchemy 5e" }).click();

  const downloading = page.waitForEvent("download");
  await page.getByRole("listitem", { name: "Fimble Nackle" }).getByRole("button", { name: "Export Fimble Nackle" }).click();
  expect((await downloading).suggestedFilename()).toBe("Fimble Nackle.json");
});

test("deleting a character asks first, and it stays deleted after reload", async ({ page }) => {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, "fighter-1.strict.json"));
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await page.getByRole("link", { name: "Alchemy 5e" }).click();
  const brannor = page.getByRole("listitem", { name: "Brannor Ironfist" });

  page.once("dialog", (dialog) => void dialog.dismiss());
  await brannor.getByRole("button", { name: "Delete Brannor Ironfist" }).click();
  await expect(brannor).toBeVisible();

  let message = "";
  page.once("dialog", (dialog) => {
    message = dialog.message();
    void dialog.accept();
  });
  await brannor.getByRole("button", { name: "Delete Brannor Ironfist" }).click();
  await expect(page.getByText("No characters yet. Import a character file to add one.")).toBeVisible();
  expect(message).toBe("Delete Brannor Ironfist? This cannot be undone.");

  await page.reload();
  await expect(page.getByText("No characters yet. Import a character file to add one.")).toBeVisible();
});
