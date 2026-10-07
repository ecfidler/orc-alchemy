import { expect, test } from "@playwright/test";

test("a new character becomes a dwarf acolyte fighter 1, and the preview follows each pick", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]+$/);

  const builder = page.getByRole("region", { name: "Builder" });
  const preview = page.getByRole("region", { name: "Preview" });
  const hp = preview.getByLabel("Hit Points", { exact: true });
  // emptyCharacter is a level 1 barbarian with Con 13.
  await expect(preview.getByLabel("Class", { exact: true })).toHaveText("Barbarian 1");
  await expect(hp).toHaveText("13 / 13");

  // Race: a dwarf has Con +2 and a speed of 25 ft.
  await builder.getByRole("button", { name: "Dwarf", exact: true }).click();
  await expect(builder.getByRole("button", { name: "Dwarf", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(preview.getByLabel("Race", { exact: true })).toHaveText("Dwarf");
  await expect(preview.getByLabel("Speed", { exact: true })).toHaveText("25 ft.");
  await expect(hp).toHaveText("14 / 14");
  // Picking another race replaces it, and the dwarf's subrace opens under it.
  await builder.getByRole("button", { name: "Elf", exact: true }).click();
  await expect(preview.getByLabel("Race", { exact: true })).toHaveText("Elf");
  await builder.getByRole("button", { name: "Dwarf", exact: true }).click();
  await expect(builder.getByRole("region", { name: /^Subrace/ })).toBeVisible();
  await expect(preview.getByLabel("Race", { exact: true })).toHaveText("Dwarf");

  await builder.getByRole("button", { name: "Background", exact: true }).click();
  await builder.getByRole("button", { name: "Acolyte", exact: true }).click();
  await expect(preview.getByLabel("Background", { exact: true })).toHaveText("Acolyte");
  await expect(preview).toContainText("Shelter the Faithful");

  // Class: a fighter's hit die is d10, so 10 + Con +2.
  await builder.getByRole("button", { name: "Class", exact: true }).click();
  await builder.getByRole("button", { name: "Fighter", exact: true }).click();
  await expect(builder.getByRole("button", { name: "Fighter", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(preview.getByLabel("Class", { exact: true })).toHaveText("Fighter 1");
  await expect(hp).toHaveText("12 / 12");
  await expect(builder.getByRole("region", { name: /^Fighting Style/ })).toBeVisible();

  // The builder links to the sheet, which shows the same character.
  await page.getByRole("link", { name: "Sheet" }).click();
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  // The URL changes before the page does, and the builder has a Class region too.
  await expect(page.getByRole("region", { name: "Builder" })).toHaveCount(0);
  await expect(page.getByLabel("Class", { exact: true })).toHaveText("Fighter 1");
  await expect(page.getByLabel("Race", { exact: true })).toHaveText("Dwarf");
  await page.getByRole("link", { name: "Build" }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]+$/);
});

test("a pick the engine refuses shows its reason at the selection", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  const builder = page.getByRole("region", { name: "Builder" });
  // A level 1 character has no feat to pick.
  await builder.getByRole("button", { name: "Feats", exact: true }).click();
  await builder.getByRole("button", { name: "Grappler" }).click();
  await expect(builder.getByRole("alert")).toHaveText(/no selections remain/);
  await expect(page.getByRole("region", { name: "Preview" }).getByLabel("Class", { exact: true })).toHaveText("Barbarian 1");
});
