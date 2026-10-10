import { expect, test } from "@playwright/test";

// ORC-75: a class made in the class form is a class a new character can take.
test("a class made in the class form can be picked for a new character", async ({ page }) => {
  await page.goto("/content/new/class");
  await page.getByRole("textbox", { name: "Name" }).fill("Rune Knight");
  await page.getByRole("combobox", { name: "Hit die" }).selectOption("10");
  await page.getByRole("checkbox", { name: "Strength saving throw" }).check();
  await page.getByRole("button", { name: "Add feature / trait" }).click();
  await page.getByRole("textbox", { name: "Feature 1 name" }).fill("Rune Carver");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);

  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]+$/);
  const builder = page.getByRole("region", { name: "Builder" });
  const preview = page.getByRole("region", { name: "Preview" });
  await page.getByRole("navigation", { name: "Steps" }).getByRole("button", { name: /^Class/ }).click();
  await builder.getByLabel("Class 1", { exact: true }).selectOption("Rune Knight");
  await expect(builder.getByLabel("Class 1", { exact: true })).toHaveValue("rune-knight");
  await expect(preview.getByLabel("Class", { exact: true })).toHaveText("Rune Knight 1");
  await expect(preview).toContainText("Rune Carver");
});
