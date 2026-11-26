import { expect, test } from "@playwright/test";
import { newCharacter, openStep } from "./builder-helpers.ts";
import { openSheetPanel } from "./sheet-panel.ts";

// ORC-76: a language made in the language form is one of a new human's language choices.
test("a language made in the language form is a language choice of a new character", async ({ page }) => {
  await page.goto("/content/new/language");
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Name" }).fill("Deep Stone");
  await page.getByRole("textbox", { name: "Description" }).fill("The tongue of the deep earth.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);
  await expect(page.getByText("1 language", { exact: true })).toBeVisible();

  await newCharacter(page);
  const builder = page.getByRole("region", { name: "Builder" });
  await openStep(page, "Race");
  await builder.getByRole("button", { name: "Human", exact: true }).click();
  // The human's choice of a language is on the Proficiencies step (ORC-339).
  await page
    .getByRole("navigation", { name: "Steps" })
    .getByRole("button", { name: /^Proficiencies(, .*)?$/ })
    .click();
  await builder.getByRole("button", { name: "Deep Stone", exact: true }).click();
  await expect((await openSheetPanel(page)).getByText("Deep Stone")).toBeVisible();
});
