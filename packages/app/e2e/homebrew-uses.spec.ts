import { pickOption } from "@orc-alchemy/ui/testing/playwright";
import { expect, type Page, test } from "@playwright/test";
import { addFirstClass, section as builderSection, newCharacter, openStep, pickIn } from "./builder-helpers.ts";
import { summaryCard } from "./sheet-panel.ts";

// ORC-204: feature uses made in a form show as use bubbles on a character's sheet.

const uses = (page: Page, n: number) => page.getByRole("group", { name: `Feature ${n} Uses` });
const combobox = (page: Page, name: string) => page.getByRole("combobox", { name, exact: true });

/** Adds feature n with a name and a type. */
async function addFeature(page: Page, n: number, name: string, type: string) {
  await page.getByRole("button", { name: "Add a feature" }).click();
  await page.getByRole("textbox", { name: `Feature ${n} name` }).fill(name);
  await pickOption(combobox(page, `Feature ${n} type`), type);
}

test("a feature with fixed uses and one with scaled uses show their bubbles on the sheet", async ({ page }) => {
  await page.goto("/content/new/race");
  await page.getByRole("textbox", { name: "Name" }).fill("Tidecaller");
  await addFeature(page, 1, "Brine Blessing", "Action");
  await uses(page, 1).getByRole("button", { name: "Fixed" }).click();
  await pickOption(combobox(page, "Feature 1 amount"), "3");
  await addFeature(page, 2, "Tidal Reserve", "Bonus Action");
  await uses(page, 2).getByRole("button", { name: "Scaled" }).click();
  await pickOption(combobox(page, "Feature 2 equal to"), "Character level × n");
  await pickOption(combobox(page, "Feature 2 n"), "10");
  await page.getByRole("group", { name: "Feature 2 Recharges" }).getByRole("button", { name: "Short rest" }).click();
  // The preview, for the example character of level 5.
  await expect(page.getByRole("group", { name: "Feature 2 preview" }).getByRole("button", { name: "Tidal Reserve, 50 of 50 left" })).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);

  await newCharacter(page);
  // A level 1 character: a fighter, for its level.
  await addFirstClass(page, "Fighter");
  await openStep(page, "Race");
  await pickIn(builderSection(page, "Race"), "Tidecaller");
  await expect(summaryCard(page).getByLabel("Race", { exact: true })).toHaveText("Tidecaller");
  await page.getByRole("link", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await expect(page.getByRole("region", { name: "Builder" })).toHaveCount(0);

  const section = (title: string) => page.getByRole("heading", { level: 3, name: title, exact: true }).locator("..");
  const blessing = section("Actions").getByRole("group", { name: "Brine Blessing" });
  await expect(blessing.getByRole("slider", { name: "Brine Blessing" }).locator(".ui-slot-circle")).toHaveCount(3);
  await expect(blessing.getByText("Long rest")).toBeVisible();
  // A fighter 1 is level 1: 10 × 1 is a pool of 10.
  const reserve = section("Bonus Actions").getByRole("group", { name: "Tidal Reserve" });
  await expect(reserve.getByRole("button", { name: "Tidal Reserve, 10 of 10 left" })).toBeVisible();
  await expect(reserve.getByText("Short rest")).toBeVisible();
});
