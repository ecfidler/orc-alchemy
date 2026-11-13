import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { SUGGESTION_PACK } from "../src/components/builders/suggested-uses-pack.ts";

// ORC-206: the form reads the text of a feature and suggests uses and a type. One click fills the control.

const text = (name: string) => SUGGESTION_PACK.find((f) => f.name === name)!.description;
const combobox = (page: Page, name: string) => page.getByRole("combobox", { name, exact: true });
const group = (page: Page, name: string) => page.getByRole("group", { name, exact: true });
/** The card of feature n: the box around its fields. */
const card = (page: Page, n: number) => page.getByRole("textbox", { name: `Feature ${n} name` }).locator("xpath=ancestor::div[contains(@class, 'bg-paper-raised')][1]");
/** The yellow line that has the button. */
const line = (button: Locator) => button.locator("xpath=ancestor::p[1]");

/** A new race with one feature: the text of Song of Courage from the test pack, with no uses and no type. */
async function addSongOfCourage(page: Page) {
  await page.goto("/content/new/race");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Tidecaller");
  await page.getByRole("button", { name: "Add a feature" }).click();
  await page.getByRole("textbox", { name: "Feature 1 name" }).fill("Song of Courage");
  await page.getByRole("textbox", { name: "Feature 1 description" }).fill(text("Song of Courage"));
}

test("the uses line and the type line fill the controls with one click each, and go away", async ({ page }) => {
  await addSongOfCourage(page);
  const usesButton = page.getByRole("button", { name: "Feature 1 uses: Use this" });
  const typeButton = page.getByRole("button", { name: "Feature 1 type: Use this" });
  await expect(line(usesButton)).toContainText("Suggested: Charisma modifier uses (minimum 1), long rest.");
  await expect(line(typeButton)).toContainText("Suggested type: Bonus Action.");
  await expect(group(page, "Feature 1 Uses").getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "true");

  await usesButton.click();
  await expect(usesButton).toHaveCount(0);
  await expect(group(page, "Feature 1 Uses").getByRole("button", { name: "Scaled" })).toHaveAttribute("aria-pressed", "true");
  await expect(combobox(page, "Feature 1 equal to")).toHaveText("Charisma modifier");
  await expect(combobox(page, "Feature 1 minimum")).toHaveText("1");
  await expect(group(page, "Feature 1 Recharges").getByRole("button", { name: "Long rest" })).toHaveAttribute("aria-pressed", "true");

  await typeButton.click();
  await expect(typeButton).toHaveCount(0);
  await expect(combobox(page, "Feature 1 type")).toHaveText("Bonus Action");
  // The preview puts the feature in Bonus Actions, with a bubble.
  await expect(group(page, "Feature 1 preview").getByRole("heading", { level: 3 })).toHaveText("Bonus Actions");
});

test("the feat's own section shows the line of the feat's description", async ({ page }) => {
  await page.goto("/content/new/feat");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Tide-Touched");
  await page.getByRole("textbox", { name: "Description", exact: true }).fill(text("Tidal Surge"));
  const usesButton = page.getByRole("button", { name: "Feat uses: Use this" });
  await expect(line(usesButton)).toContainText("Suggested: 1 use, long rest.");
  await usesButton.click();
  await expect(group(page, "Feat Uses").getByRole("button", { name: "Fixed" })).toHaveAttribute("aria-pressed", "true");
  await expect(usesButton).toHaveCount(0);
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bun run e2e -- homebrew-suggested-uses.spec.ts -g orc-206
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`orc-206 suggested uses, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (locator: Locator, what: string) => locator.screenshot({ path: join(dir, `orc-206-${what}-${theme}.png`) });
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      await page.setViewportSize({ width: 1100, height: 900 });

      await addSongOfCourage(page);
      await page.evaluate(() => document.fonts.ready);
      await shot(card(page, 1), "uses-line");

      // After "Use this" for the uses: the control is filled, and the type line stays.
      await page.getByRole("button", { name: "Feature 1 uses: Use this" }).click();
      await expect(combobox(page, "Feature 1 equal to")).toHaveText("Charisma modifier");
      await shot(card(page, 1), "type-line");

      await page.getByRole("button", { name: "Feature 1 type: Use this" }).click();
      await expect(combobox(page, "Feature 1 type")).toHaveText("Bonus Action");
      await shot(card(page, 1), "after-use-this");

      // The feat's own section.
      await page.goto("/content/new/feat");
      await page.getByRole("textbox", { name: "Name", exact: true }).fill("Tide-Touched");
      await page.getByRole("textbox", { name: "Description", exact: true }).fill(text("Tidal Surge"));
      await expect(page.getByRole("button", { name: "Feat uses: Use this" })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await shot(group(page, "Uses of the feat"), "feat-line");
    });
  }
});
