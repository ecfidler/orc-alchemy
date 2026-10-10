import { expect, test } from "@playwright/test";

// ORC-76: a language made in the language form is one of a new human's language choices.
test("a language made in the language form is a language choice of a new character", async ({ page }) => {
  await page.goto("/content/new/language");
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Name" }).fill("Deep Stone");
  await page.getByRole("textbox", { name: "Description" }).fill("The tongue of the deep earth.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);
  await expect(page.getByText("1 language", { exact: true })).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]+$/);
  const builder = page.getByRole("region", { name: "Builder" });
  await builder.getByRole("button", { name: "Human", exact: true }).click();
  await builder.getByRole("button", { name: "Deep Stone", exact: true }).click();
  await expect(page.getByRole("region", { name: "Preview" }).getByText("Deep Stone")).toBeVisible();
});
