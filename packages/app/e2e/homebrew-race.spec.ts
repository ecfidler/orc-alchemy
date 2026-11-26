import { pickFromPicker, pickOption } from "@orc-alchemy/ui/testing/playwright";
import { expect, test } from "@playwright/test";
import { newCharacter, openStep, pickIn, section } from "./builder-helpers.ts";
import { summaryCard } from "./sheet-panel.ts";

// ORC-75: a race made in the race form is one of a new character's race choices.
test("a race made in the race form is a race choice of a new character", async ({ page }) => {
  await page.goto("/content/new/race");
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Name" }).fill("Mezzoloth");
  await pickOption(page.getByRole("combobox", { name: "Speed", exact: true }), "35");
  await pickOption(page.getByRole("combobox", { name: "Constitution" }), "+2");
  await pickFromPicker(page.getByRole("group", { name: "Languages" }).getByRole("button", { name: "Add a language", exact: true }), "Infernal");
  await page.getByRole("button", { name: "Add a feature" }).click();
  await page.getByRole("textbox", { name: "Feature 1 name" }).fill("Multilimbed");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);

  await newCharacter(page);
  const preview = summaryCard(page);
  await openStep(page, "Race");
  await pickIn(section(page, "Race"), "Mezzoloth");
  await expect(preview.getByLabel("Race", { exact: true })).toHaveText("Mezzoloth");
  await expect(preview.getByLabel("Speed", { exact: true })).toHaveText("35 ft.");
});
