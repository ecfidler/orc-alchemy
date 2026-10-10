import { expect, test } from "@playwright/test";

// ORC-75: a race made in the race form is one of a new character's race choices.
test("a race made in the race form is a race choice of a new character", async ({ page }) => {
  await page.goto("/content/new/race");
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Name" }).fill("Mezzoloth");
  await page.getByRole("combobox", { name: "Speed", exact: true }).selectOption("35");
  await page.getByRole("combobox", { name: "Constitution" }).selectOption("2");
  await page.getByRole("group", { name: "Languages" }).getByRole("checkbox", { name: "Infernal" }).check();
  await page.getByRole("button", { name: "Add feature / trait" }).click();
  await page.getByRole("textbox", { name: "Feature 1 name" }).fill("Multilimbed");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);

  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]+$/);
  const builder = page.getByRole("region", { name: "Builder" });
  const preview = page.getByRole("region", { name: "Preview" });
  await builder.getByRole("button", { name: "Mezzoloth", exact: true }).click();
  await expect(preview.getByLabel("Race", { exact: true })).toHaveText("Mezzoloth");
  await expect(preview.getByLabel("Speed", { exact: true })).toHaveText("35 ft.");
});
