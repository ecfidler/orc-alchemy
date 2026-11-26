import { pickFromPicker } from "@orc-alchemy/ui/testing/playwright";
import { expect, test } from "@playwright/test";
import { newCharacter, pickIn, section } from "./builder-helpers.ts";
import { openSheetPanel, summaryCard } from "./sheet-panel.ts";

// ORC-76: a background made in the background form is one of a new character's background choices.
test("a background made in the background form is a background choice of a new character", async ({ page }) => {
  await page.goto("/content/new/background");
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Name" }).fill("Spy");
  await pickFromPicker(page.getByRole("group", { name: "Skill proficiencies" }).getByRole("button", { name: "Add a skill" }), "Deception");
  await page.getByRole("button", { name: "Add a feature" }).click();
  await page.getByRole("textbox", { name: "Feature 1 name" }).fill("Criminal Contact");
  await page.getByRole("textbox", { name: "Feature 1 description" }).fill("reliable criminal underworld contact");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);

  await newCharacter(page);
  const preview = summaryCard(page);
  await page
    .getByRole("navigation", { name: "Steps" })
    .getByRole("button", { name: /^Background(, .*)?$/ })
    .click();
  await pickIn(section(page, "Background"), "Spy");
  await expect(preview.getByLabel("Background", { exact: true })).toHaveText("Spy");
  await expect(await openSheetPanel(page)).toContainText("Criminal Contact");
});
