import { expect, test } from "@playwright/test";

// ORC-76: a background made in the background form is one of a new character's background choices.
test("a background made in the background form is a background choice of a new character", async ({ page }) => {
  await page.goto("/content/new/background");
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Name" }).fill("Spy");
  await page.getByRole("group", { name: "Skill Proficiencies" }).getByRole("checkbox", { name: "Deception" }).check();
  await page.getByRole("button", { name: "Add feature / trait" }).click();
  await page.getByRole("textbox", { name: "Feature 1 name" }).fill("Criminal Contact");
  await page.getByRole("textbox", { name: "Feature 1 description" }).fill("reliable criminal underworld contact");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);

  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]+$/);
  const builder = page.getByRole("region", { name: "Builder" });
  const preview = page.getByRole("region", { name: "Preview" });
  await page.getByRole("navigation", { name: "Steps" }).getByRole("button", { name: /^Background( \(\d+ to do\))?$/ }).click();
  await builder.getByRole("button", { name: "Spy", exact: true }).click();
  await expect(preview.getByLabel("Background", { exact: true })).toHaveText("Spy");
  await expect(preview).toContainText("Criminal Contact");
});
