// Helpers for the e2e specs that make a new character in the builder (ORC-342): a new character has no class, and
// it opens on the Name step.
import { pickOption } from "@orc-alchemy/ui/testing/playwright";
import { expect, type Page } from "@playwright/test";

/** A step button of the rail. Its name ends with its count of picks left, when it has some: "Class, 2 picks left". */
export const stepButton = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Steps" }).getByRole("button", { name: new RegExp(`^${name}(, .*)?$`) });

/** Opens a step of the builder with the rail, and waits for its title. */
export async function openStep(page: Page, name: string) {
  await stepButton(page, name).click();
  await expect(page.getByRole("region", { name: "Builder" }).getByRole("heading", { level: 2 })).toHaveText(name);
}

/** Makes a new character from the home page, and waits for the builder on its Name step. */
export async function newCharacter(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]+\?step=Name$/);
  await expect(page.getByRole("region", { name: "Builder" }).getByRole("heading", { level: 2 })).toHaveText("Name");
}

/** Opens the Class step of a character with no class, and adds its first class. */
export async function addFirstClass(page: Page, name: string) {
  await openStep(page, "Class");
  const builder = page.getByRole("region", { name: "Builder" });
  await pickOption(builder.getByLabel("Add a class", { exact: true }), name);
  await builder.getByRole("button", { name: "Add class" }).click();
  await expect(builder.getByLabel("Class 1", { exact: true })).toHaveText(name);
}
