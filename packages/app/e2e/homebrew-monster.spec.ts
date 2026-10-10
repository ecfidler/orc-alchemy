import { expect, test } from "@playwright/test";

// ORC-74: a monster made in the monster form is listed on My Content.
test("a monster made in the monster form is listed on My Content", async ({ page }) => {
  await page.goto("/content/new/monster");
  await page.getByRole("textbox", { name: "Name" }).fill("Mud Imp");
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await page.getByRole("combobox", { name: "Hit die count", exact: true }).selectOption("3");
  await page.getByRole("combobox", { name: "Hit die", exact: true }).selectOption("6");
  await page.getByRole("button", { name: "Add action / feature" }).click();
  await page.getByRole("textbox", { name: "Feature 1 name" }).fill("Claw");
  await page.getByRole("combobox", { name: "Feature 1 type" }).selectOption("Action");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page).toHaveURL(/\/content$/);
  await page.getByRole("region", { name: "Default Option Source" }).getByText("1 monster").click();
  const monsters = page.getByRole("list", { name: "Default Option Source monsters" });
  await expect(monsters).toContainText("Mud Imp");
  await monsters.getByRole("link", { name: "Edit Mud Imp" }).click();
  await expect(page.getByRole("textbox", { name: "Feature 1 name" })).toHaveValue("Claw");
});
