import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pickOption } from "@orc-alchemy/ui/testing/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// ORC-204: feature uses made in a form show as use bubbles on a character's sheet.

const uses = (page: Page, n: number) => page.getByRole("group", { name: `Feature ${n} Uses` });
const combobox = (page: Page, name: string) => page.getByRole("combobox", { name, exact: true });
/** The card of feature n: the box around its fields. */
const card = (page: Page, n: number) => page.getByRole("textbox", { name: `Feature ${n} name` }).locator("xpath=ancestor::div[contains(@class, 'bg-paper-raised')][1]");

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
  await expect(page.getByRole("group", { name: "Feature 2 preview" }).getByRole("button", { name: "50 / 50 left. Spend 5" })).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);

  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]+$/);
  await page.getByRole("region", { name: "Builder" }).getByRole("button", { name: "Tidecaller", exact: true }).click();
  await expect(page.getByRole("region", { name: "Preview" }).getByLabel("Race", { exact: true })).toHaveText("Tidecaller");
  await page.getByRole("link", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await expect(page.getByRole("region", { name: "Builder" })).toHaveCount(0);

  const section = (title: string) => page.getByRole("heading", { level: 3, name: title, exact: true }).locator("..");
  const blessing = section("Actions").getByRole("group", { name: "Brine Blessing" });
  await expect(blessing.getByRole("button", { name: /^Use / })).toHaveCount(3);
  await expect(blessing.getByText("Long rest")).toBeVisible();
  // A new character is level 1: 10 × 1 is a pool of 10.
  const reserve = section("Bonus Actions").getByRole("group", { name: "Tidal Reserve" });
  await expect(reserve.getByRole("button", { name: "10 / 10 left. Spend 1" })).toBeVisible();
  await expect(reserve.getByText("Short rest")).toBeVisible();
});

// An old pack with a minute rest, as an .orcbrew file.
const OLD_PACK = `{:orcpub.dnd.e5/races {:sunken {:key :sunken :name "Sunken" :option-pack "Old Reef" :speed 30 :size "Medium"
 :traits [{:name "Guardian Wave" :type :reaction :description "When an ally within 5 feet of you is hit, you halve the damage." :frequency {:units :orcpub.dnd.e5.units/minute :amount 1}}]}}}`;

async function loadOldPack(page: Page) {
  await page.goto("/import");
  await page.getByLabel("Load homebrew file").setInputFiles({ name: "Old Reef.orcbrew", mimeType: "application/octet-stream", buffer: Buffer.from(OLD_PACK) });
  await expect(page.getByRole("region", { name: "Import log" })).toBeVisible();
}

// Screenshots for the PR: PR_SCREENSHOTS=1 bun run e2e -- homebrew-uses.spec.ts -g orc-204
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`orc-204 uses control and preview, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (locator: Locator, what: string) => locator.screenshot({ path: join(dir, `orc-204-${what}-${theme}.png`) });
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      await page.setViewportSize({ width: 1100, height: 900 });

      // Fixed uses in the race form, and scaled by an ability.
      await page.goto("/content/new/race");
      await addFeature(page, 1, "Brine Blessing", "Action");
      await page.getByRole("textbox", { name: "Feature 1 description" }).fill("You touch a creature and end one disease or poison on it.");
      await uses(page, 1).getByRole("button", { name: "Fixed" }).click();
      await pickOption(combobox(page, "Feature 1 amount"), "3");
      await page.getByRole("group", { name: "Feature 1 preview" }).getByRole("button", { name: "Use 1" }).click();
      await page.evaluate(() => document.fonts.ready);
      await shot(card(page, 1), "fixed");

      await addFeature(page, 2, "Sea Luck", "Reaction");
      await page.getByRole("textbox", { name: "Feature 2 description" }).fill("When you fail a saving throw, you can reroll it.");
      await uses(page, 2).getByRole("button", { name: "Scaled" }).click();
      await pickOption(combobox(page, "Feature 2 equal to"), "Wisdom modifier");
      await shot(card(page, 2), "scaled-ability");

      // A pool above 8.
      await addFeature(page, 3, "Deep Reserves", "Action");
      await page.getByRole("textbox", { name: "Feature 3 description" }).fill("You have a pool of healing. As an action, you restore hit points from the pool.");
      await uses(page, 3).getByRole("button", { name: "Fixed" }).click();
      await pickOption(combobox(page, "Feature 3 amount"), "25");
      await page.getByRole("group", { name: "Feature 3 preview" }).getByRole("button", { name: /^25 \/ 25 left/ }).click();
      await shot(card(page, 3), "pool");

      // The delete dialog.
      await page.getByRole("button", { name: "Delete feature 1" }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await page.screenshot({ path: join(dir, `orc-204-delete-dialog-${theme}.png`) });
      await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();

      // Scaled by the class level, with the sentence, in the class form.
      await page.goto("/content/new/class");
      await page.getByRole("textbox", { name: "Name" }).fill("Paladin");
      await addFeature(page, 1, "Tidal Reserve", "Action");
      await page.getByRole("textbox", { name: "Feature 1 description" }).fill("You have a pool of power. As an action, you touch a creature and restore hit points from the pool.");
      await uses(page, 1).getByRole("button", { name: "Scaled" }).click();
      await pickOption(combobox(page, "Feature 1 equal to"), "Paladin level × n");
      await pickOption(combobox(page, "Feature 1 n"), "5");
      await expect(page.getByText("Uses equal 5 × your paladin level. A level 5 character gets 25.")).toBeVisible();
      await shot(card(page, 1), "scaled-class-level");

      // A rest of an old pack.
      await loadOldPack(page);
      await page.goto(`/content/edit/race/${encodeURIComponent("Old Reef")}/sunken`);
      await expect(page.getByRole("group", { name: "Feature 1 Recharges" }).getByRole("button", { name: "Minute (from the pack)" })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await shot(card(page, 1), "old-pack-unit");
    });
  }
});
