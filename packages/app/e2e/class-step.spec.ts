// The Class step, in a browser (ORC-349, docs/design/character-builder.md "The class cards", "The class block", "No
// layout shift"): the pick of a first class from the cards and the modal, a change of class and a lower level that ask
// first (ORC-344), the level field and its buttons, the header of a block that does not move, a character with two
// classes, and the screenshots of the PR.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { addFirstClass, changeClass, classCard, newCharacter, openStep, pickIn, section } from "./builder-helpers.ts";
import { summaryCard } from "./sheet-panel.ts";

const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");

const builder = (page: Page) => page.getByRole("region", { name: "Builder" });
const block = (page: Page, name: string) => builder(page).getByRole("region", { name, exact: true });
const levelField = (page: Page, name: string) => builder(page).getByRole("textbox", { name: `${name} level`, exact: true });
const classLine = (page: Page) => summaryCard(page).getByLabel("Class", { exact: true });
const box = async (locator: Locator) => {
  const b = (await locator.boundingBox())!;
  return [b.x, b.y, b.width, b.height];
};

/** Imports a character file and opens it in the builder on the Class step. */
async function importOnClass(page: Page, file: string) {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, file));
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await openStep(page, "Class");
}

/** A new Fighter 3 with Defense and Champion, on the Class step. */
async function fighter3(page: Page) {
  await newCharacter(page);
  await addFirstClass(page, "Fighter");
  await pickIn(section(page, "Fighting Style"), "Defense");
  await builder(page).getByRole("button", { name: "Add a Fighter level" }).click();
  await builder(page).getByRole("button", { name: "Add a Fighter level" }).click();
  await pickIn(section(page, "Martial Archetype"), "Champion");
  await expect(classLine(page)).toHaveText("Fighter 3");
}

test("a new character picks its first class from the cards and the modal", async ({ page }) => {
  await newCharacter(page);
  await openStep(page, "Class");
  const cards = builder(page).locator("[data-class-card]");
  await expect(cards).toHaveCount(12);
  // 6 in a row: the first row has 6 cards with the same top, and the cards have one size.
  const tops = await cards.evaluateAll((all) => all.map((card) => Math.round(card.getBoundingClientRect().top)));
  expect(tops.filter((top) => top === tops[0])).toHaveLength(6);
  const sizes = await cards.evaluateAll((all) =>
    all.map((card) => `${Math.round(card.getBoundingClientRect().width)}x${Math.round(card.getBoundingClientRect().height)}`),
  );
  expect(new Set(sizes).size).toBe(1);

  // A click opens the modal: the facts, the features table, and Choose. Escape gives the focus back to the card.
  await classCard(builder(page), "Fighter").click();
  const modal = page.getByRole("dialog", { name: "Fighter", exact: true });
  await expect(modal.getByRole("columnheader")).toHaveText(["Level", "Features"]);
  await expect(modal.getByRole("row").nth(1)).toHaveText("1Fighting Style, Second Wind");
  await expect(modal.getByRole("button", { name: "Choose Fighter" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(classCard(builder(page), "Fighter")).toBeFocused();
  await expect(classLine(page)).toHaveText("");

  // Choose picks the class, and the focus goes to Change of its block.
  await classCard(builder(page), "Fighter").click();
  await modal.getByRole("button", { name: "Choose Fighter" }).click();
  await expect(classLine(page)).toHaveText("Fighter 1");
  await expect(builder(page).getByRole("button", { name: "Change Fighter" })).toBeFocused();
  await expect(block(page, "Fighter").getByRole("heading", { level: 3 })).toHaveText("Fighter");
});

test("Change to a class with picks asks first, then makes the change", async ({ page }) => {
  await fighter3(page);
  await changeClass(page, "Fighter", "Rogue");
  const question = page.getByRole("alertdialog", { name: "Replace Fighter with Rogue?" });
  await expect(question).toContainText("Fighting Style: Defense");
  await expect(question).toContainText("Martial Archetype: Champion");
  await question.getByRole("button", { name: "Cancel" }).click();
  await expect(classLine(page)).toHaveText("Fighter 3");
  await expect(builder(page).getByRole("button", { name: "Change Fighter" })).toBeFocused();

  await changeClass(page, "Fighter", "Rogue");
  await question.getByRole("button", { name: "Replace" }).click();
  await expect(classLine(page)).toHaveText("Rogue 1");
  await expect(builder(page).getByRole("button", { name: "Change Rogue" })).toBeFocused();
});

test("a lower level with picks asks first; Cancel gives the focus back to the field", async ({ page }) => {
  await fighter3(page);
  const field = levelField(page, "Fighter");
  await field.fill("2");
  await field.press("Enter");
  const question = page.getByRole("alertdialog", { name: "Lower Fighter to level 2?" });
  await expect(question).toContainText("Martial Archetype: Champion");
  await question.getByRole("button", { name: "Cancel" }).click();
  await expect(classLine(page)).toHaveText("Fighter 3");
  await expect(field).toHaveValue("3");
  await expect(field).toBeFocused();

  await builder(page).getByRole("button", { name: "Remove a Fighter level" }).click();
  await question.getByRole("button", { name: "Remove" }).click();
  await expect(classLine(page)).toHaveText("Fighter 2");
  await expect(field).toHaveValue("2");
});

test("the level field takes 1 to 20, and the buttons have their names", async ({ page }) => {
  await newCharacter(page);
  await addFirstClass(page, "Wizard");
  const minus = builder(page).getByRole("button", { name: "Remove a Wizard level", exact: true });
  const plus = builder(page).getByRole("button", { name: "Add a Wizard level", exact: true });
  await expect(minus).toBeDisabled();
  await expect(plus).toBeEnabled();
  const field = levelField(page, "Wizard");
  for (const typed of ["0", "21"]) {
    await field.fill(typed);
    await field.press("Enter");
    await expect(page.locator("[data-toast-status]")).toHaveText("A class level is from 1 to 20.");
    await expect(field).toHaveValue("1");
    await expect(classLine(page)).toHaveText("Wizard 1");
  }
  await field.fill("20");
  await field.press("Tab");
  await expect(classLine(page)).toHaveText("Wizard 20");
  await expect(plus).toBeDisabled();
  await expect(minus).toBeEnabled();
});

test("a change of level does not move the header of the block", async ({ page }) => {
  await newCharacter(page);
  await addFirstClass(page, "Fighter");
  const header = block(page, "Fighter").locator("h3").locator("..");
  const parts = [header, levelField(page, "Fighter"), builder(page).getByRole("button", { name: "Change Fighter" })];
  const before = await Promise.all(parts.map(box));
  for (let n = 0; n < 9; n++) await builder(page).getByRole("button", { name: "Add a Fighter level" }).click();
  await expect(classLine(page)).toHaveText("Fighter 10");
  expect(await Promise.all(parts.map(box))).toEqual(before);
  // A change of class does not move it either. The fighter has no pick, so the change asks nothing.
  await changeClass(page, "Fighter", "Barbarian");
  await expect(classLine(page)).toHaveText("Barbarian 1");
  const after = [
    block(page, "Barbarian").locator("h3").locator(".."),
    levelField(page, "Barbarian"),
    builder(page).getByRole("button", { name: "Change Barbarian" }),
  ];
  expect(await Promise.all(after.map(box))).toEqual(before);
});

test("a character with two classes shows a block for each", async ({ page }) => {
  await importOnClass(page, "fighter-3-wizard-2.strict.json");
  for (const [name, level] of [
    ["Fighter", "3"],
    ["Wizard", "2"],
  ]) {
    const each = block(page, name);
    await expect(each.getByRole("heading", { level: 3 })).toHaveText(name);
    await expect(levelField(page, name)).toHaveValue(level);
    for (const button of [`Remove a ${name} level`, `Add a ${name} level`, `About ${name}`, `Change ${name}`])
      await expect(each.getByRole("button", { name: button, exact: true })).toBeVisible();
  }
  // About opens the modal with no Choose button.
  await block(page, "Wizard").getByRole("button", { name: "About Wizard" }).click();
  const modal = page.getByRole("dialog", { name: "Wizard", exact: true });
  await expect(modal.getByRole("row").nth(1)).toHaveText("1Arcane Recovery, Spellcasting");
  await expect(modal.getByRole("button", { name: /^Choose/ })).toHaveCount(0);
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bunx playwright test e2e/class-step.spec.ts -g orc-349 --trace off
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  const ready = async (page: Page) => {
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
  };

  for (const theme of ["light", "dark"])
    for (const width of [1280, 390]) {
      const size = width === 390 ? "390" : "desktop";
      test(`orc-349 the Class step, ${size}, ${theme}`, async ({ page }) => {
        mkdirSync(dir, { recursive: true });
        const shot = (locator: Locator, what: string) =>
          locator.screenshot({ path: join(dir, `orc-349-${what}-${size}-${theme}.png`), animations: "disabled" });
        const full = (what: string) => page.screenshot({ path: join(dir, `orc-349-${what}-${size}-${theme}.png`), animations: "disabled" });
        await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
        await page.setViewportSize({ width, height: 900 });
        await newCharacter(page);
        await openStep(page, "Class");
        await ready(page);
        await shot(builder(page), "cards");
        await classCard(builder(page), "Fighter").click();
        const modal = page.getByRole("dialog", { name: "Fighter", exact: true });
        await expect(modal.getByRole("columnheader")).toHaveText(["Level", "Features"]);
        await ready(page);
        await full("modal");
        await modal.getByRole("button", { name: "Choose Fighter" }).click();
        await builder(page).getByRole("button", { name: "Add a Fighter level" }).click();
        await builder(page).getByRole("button", { name: "Add a Fighter level" }).click();
        // Under 720px the summary card does not show.
        await expect(levelField(page, "Fighter")).toHaveValue("3");
        await expect(builder(page).getByRole("region", { name: /^Martial Archetype/ })).toBeVisible();
        await ready(page);
        await shot(builder(page), "block");
        await builder(page).getByRole("button", { name: "Change Fighter" }).click();
        await expect(page.getByRole("dialog", { name: "Change Fighter" })).toBeVisible();
        await ready(page);
        await full("change");
      });
    }
});
