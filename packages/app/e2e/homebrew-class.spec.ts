import { pickOption } from "@orc-alchemy/ui/testing/playwright";
import { expect, test } from "@playwright/test";
import { addFirstClass, newCharacter } from "./builder-helpers.ts";
import { openSheetPanel, summaryCard } from "./sheet-panel.ts";

// ORC-75: a class made in the class form is a class a new character can take.
test("a class made in the class form can be picked for a new character", async ({ page }) => {
  await page.goto("/content/new/class");
  await page.getByRole("textbox", { name: "Name" }).fill("Rune Knight");
  await pickOption(page.getByRole("combobox", { name: "Hit die" }), "10");
  await page.getByRole("group", { name: "Saving throws" }).getByRole("checkbox", { name: "Strength" }).check();
  await page.getByRole("button", { name: "Add a feature" }).click();
  await page.getByRole("textbox", { name: "Feature 1 name" }).fill("Rune Carver");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);

  await newCharacter(page);
  const preview = summaryCard(page);
  await addFirstClass(page, "Rune Knight");
  await expect(preview.getByLabel("Class", { exact: true })).toHaveText("Rune Knight 1");
  await expect(await openSheetPanel(page)).toContainText("Rune Carver");
});
